import { GitLabMergeRequest, GitLabProject } from './types';

export class GitLabClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async fetchApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v4${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private async fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;
    const perPage = '100';

    while (true) {
      const items = await this.fetchApi<T[]>(endpoint, {
        ...params,
        page: page.toString(),
        per_page: perPage,
      });

      if (items.length === 0) break;

      allItems.push(...items);
      page++;

      if (items.length < parseInt(perPage)) break;
    }

    return allItems;
  }

  async getCurrentUser(): Promise<{ id: number; username: string; name: string }> {
    return this.fetchApi('/user');
  }

  async getUserProjects(): Promise<GitLabProject[]> {
    return this.fetchAllPages<GitLabProject>('/projects', {
      membership: 'true',
      simple: 'false',
    });
  }

  async getProjectByPath(pathWithNamespace: string): Promise<GitLabProject> {
    const encodedPath = encodeURIComponent(pathWithNamespace);
    return this.fetchApi<GitLabProject>(`/projects/${encodedPath}`);
  }

  async getProjectsByPaths(paths: string[]): Promise<GitLabProject[]> {
    const projects: GitLabProject[] = [];
    for (const path of paths) {
      try {
        const project = await this.getProjectByPath(path);
        projects.push(project);
      } catch (error) {
        console.warn(`Could not fetch project "${path}": ${error}`);
      }
    }
    return projects;
  }

  async getProjectMergedMRs(projectId: number, authorUsername?: string): Promise<GitLabMergeRequest[]> {
    const params: Record<string, string> = {
      state: 'merged',
    };
    if (authorUsername) {
      params.author_username = authorUsername;
    }

    try {
      const mrs = await this.fetchAllPages<GitLabMergeRequest>(`/projects/${projectId}/merge_requests`, params);
      return mrs.map(mr => ({ ...mr, project_id: projectId }));
    } catch (error) {
      console.warn(`Could not fetch MRs for project ${projectId}: ${error}`);
      return [];
    }
  }

  async getAllUserMergedMRs(username: string, projectPaths?: string[]): Promise<GitLabMergeRequest[]> {
    let projects: GitLabProject[];

    if (projectPaths && projectPaths.length > 0) {
      console.info(`Fetching ${projectPaths.length} specified projects...`);
      projects = await this.getProjectsByPaths(projectPaths);
    } else {
      console.info('Fetching all projects...');
      projects = await this.getUserProjects();
    }
    console.info(`Found ${projects.length} projects`);

    const allMRs: GitLabMergeRequest[] = [];

    for (const project of projects) {
      console.info(`Fetching merged MRs from: ${project.name_with_namespace}`);
      const mrs = await this.getProjectMergedMRs(project.id, username);
      const mrsWithProject = mrs.map(mr => ({
        ...mr,
        project_name: project.name_with_namespace,
      }));
      allMRs.push(...mrsWithProject);
    }

    // Sort by merge date, newest first
    allMRs.sort((a, b) => {
      const dateA = a.merged_at ? new Date(a.merged_at).getTime() : 0;
      const dateB = b.merged_at ? new Date(b.merged_at).getTime() : 0;
      return dateB - dateA;
    });

    return allMRs;
  }
}
