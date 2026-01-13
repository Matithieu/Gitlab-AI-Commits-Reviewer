import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { GitLabClient } from './gitlab-client'
import { type Config, type GitLabMergeRequest, type MRSummary } from './types'

dotenv.config()

function loadConfig(): Config | null {
  const configPath = path.join(process.cwd(), 'config.json')
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(content) as Config
  }
  return null
}

function summarizeMRs(mrs: GitLabMergeRequest[]): MRSummary {
  const projects = new Set<string>()
  const mrsByProject: Record<string, number> = {}
  const mrsByMonth: Record<string, number> = {}

  for (const mr of mrs) {
    const projectName = mr.project_name ?? `Project ${String(mr.project_id)}`
    projects.add(projectName)
    mrsByProject[projectName] = (mrsByProject[projectName] ?? 0) + 1

    if (mr.merged_at) {
      const monthKey = mr.merged_at.substring(0, 7) // YYYY-MM
      mrsByMonth[monthKey] = (mrsByMonth[monthKey] ?? 0) + 1
    }
  }

  const dates = mrs
    .filter((mr): mr is GitLabMergeRequest & { merged_at: string } => mr.merged_at !== null)
    .map((mr) => new Date(mr.merged_at).getTime())
  const minDate = dates.length ? new Date(Math.min(...dates)).toISOString().split('T')[0] : 'N/A'
  const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString().split('T')[0] : 'N/A'

  return {
    totalMRs: mrs.length,
    projectsContributed: Array.from(projects).sort(),
    dateRange: {
      from: minDate,
      to: maxDate,
    },
    mrsByProject,
    mrsByMonth,
    mergeRequests: mrs,
  }
}

function formatForLetter(summary: MRSummary): string {
  const lines: string[] = []

  lines.push('# GitLab Merge Requests Summary')
  lines.push('')
  lines.push(`**Total Merged MRs:** ${String(summary.totalMRs)}`)
  lines.push(`**Projects Contributed:** ${String(summary.projectsContributed.length)}`)
  lines.push(`**Period:** ${summary.dateRange.from} to ${summary.dateRange.to}`)
  lines.push('')

  lines.push('## Projects & Contributions')
  lines.push('')
  const sortedProjects = Object.entries(summary.mrsByProject).sort(([, a], [, b]) => b - a)

  for (const [project, count] of sortedProjects) {
    lines.push(`- **${project}**: ${String(count)} merged MRs`)
  }
  lines.push('')

  lines.push('## Merged MRs (for context)')
  lines.push('')
  lines.push('Here are your merged merge requests to help identify key contributions:')
  lines.push('')

  // Group MRs by project for better readability
  const mrsByProject: Record<string, GitLabMergeRequest[]> = {}
  for (const mr of summary.mergeRequests) {
    const projectName = mr.project_name ?? `Project ${String(mr.project_id)}`
    if (!(projectName in mrsByProject)) {
      mrsByProject[projectName] = []
    }
    mrsByProject[projectName].push(mr)
  }

  for (const [project, mrs] of Object.entries(mrsByProject)) {
    lines.push(`### ${project}`)
    for (const mr of mrs) {
      const date = mr.merged_at ? mr.merged_at.split('T')[0] : 'N/A'
      lines.push(`- [${date}] **${mr.title}**`)
      if (mr.description) {
        const shortDesc = mr.description.split('\n')[0].substring(0, 100)
        if (shortDesc) {
          lines.push(`  ${shortDesc}${mr.description.length > 100 ? '...' : ''}`)
        }
      }
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Instructions')
  lines.push('')
  lines.push(
    'Based on the merge requests listed above, please provide 3-5 bullet points summarizing the key contributions and achievements.',
  )
  lines.push('')
  lines.push('Each bullet point should:')
  lines.push('- Highlight a specific feature, improvement, or bug fix')
  lines.push('- Be concise and impactful (1-2 sentences)')
  lines.push('- Focus on the business value or technical achievement')
  lines.push('')
  lines.push('Group similar contributions together when relevant.')

  return lines.join('\n')
}

async function main(): Promise<void> {
  const gitlabUrl = process.env.GITLAB_URL
  const gitlabToken = process.env.GITLAB_TOKEN

  if (!gitlabUrl || !gitlabToken) {
    console.error('Error: Missing required environment variables.')
    console.error('Please create a .env file with:')
    console.error('  GITLAB_URL=https://your-gitlab-instance.com')
    console.error('  GITLAB_TOKEN=your-personal-access-token')
    console.error('')
    console.error('To create a GitLab Personal Access Token:')
    console.error('1. Go to your GitLab instance')
    console.error('2. Navigate to User Settings > Access Tokens')
    console.error('3. Create a token with "read_api" scope')
    process.exit(1)
  }

  const client = new GitLabClient(gitlabUrl, gitlabToken)

  try {
    console.info('Connecting to GitLab...')
    const user = await client.getCurrentUser()
    console.info(`Authenticated as: ${user.name} (${user.username})`)

    const config = loadConfig()
    const projectPaths = config?.projects

    if (projectPaths && projectPaths.length > 0) {
      console.info(`\nUsing config.json with ${String(projectPaths.length)} specified projects`)
    } else {
      console.info('\nNo config.json found, fetching from all projects...')
    }

    console.info('\nFetching your merged MRs...')
    const mrs = await client.getAllUserMergedMRs(user.username, projectPaths)

    console.info(`\nFound ${String(mrs.length)} merged MRs total.`)

    const summary = summarizeMRs(mrs)
    const formattedOutput = formatForLetter(summary)

    // Save to files
    const outputDir = path.join(process.cwd(), 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save raw data as JSON
    const jsonPath = path.join(outputDir, 'merge-requests.json')
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2))
    console.info(`\nRaw data saved to: ${jsonPath}`)

    // Save formatted summary as Markdown
    const mdPath = path.join(outputDir, 'contributions-summary.md')
    fs.writeFileSync(mdPath, formattedOutput)
    console.info(`Formatted summary saved to: ${mdPath}`)

    console.info(`\n${'='.repeat(50)}`)
    console.info(formattedOutput)
  } catch (error) {
    console.error('Error fetching GitLab data:', error)
    process.exit(1)
  }
}

void main()
