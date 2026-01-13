export interface GitLabMergeRequest {
  id: number
  iid: number
  title: string
  description: string | null
  state: string
  merged_at: string | null
  created_at: string
  author: {
    id: number
    username: string
    name: string
  }
  web_url: string
  project_id: number
  project_name?: string
  source_branch: string
  target_branch: string
  labels: string[]
}

export interface GitLabProject {
  id: number
  name: string
  name_with_namespace: string
  path_with_namespace: string
  web_url: string
}

export interface Config {
  projects: string[]
}

export interface MRSummary {
  totalMRs: number
  projectsContributed: string[]
  dateRange: {
    from: string
    to: string
  }
  mrsByProject: Record<string, number>
  mrsByMonth: Record<string, number>
  mergeRequests: GitLabMergeRequest[]
}
