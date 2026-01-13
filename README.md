No I'm not looking for another job, it was just a fun idea I had. 

# GitLab Contributions Fetcher

Fetch all your merged GitLab merge requests and generate a summary to help write cover letters or performance reviews.

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure GitLab credentials:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:
   - `GITLAB_URL` - Your self-hosted GitLab URL (e.g., `https://gitlab.yourcompany.com`)
   - `GITLAB_TOKEN` - Personal Access Token

3. **Create a GitLab Personal Access Token:**
   - Go to `{GITLAB_URL}/-/user_settings/personal_access_tokens`
   - Create a token with `read_api` scope

## Usage

```bash
pnpm dev
```

## Output

The script generates two files in the `output/` folder:

- **merge-requests.json** - Raw MR data
- **contributions-summary.md** - Formatted summary including:
  - Total merged MRs count
  - Projects contributed to
  - MRs per project
  - MR titles and descriptions grouped by project
  - Suggested bullet points for your letter
