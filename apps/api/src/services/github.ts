import type { Env } from '../index';
import { Octokit, App } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import { sign } from '@octokit/webhooks-methods';

export class GitHubService {
  private app: App;
  private env: Env;
  private owner: string;
  private repo: string;

  constructor(env: Env) {
    this.env = env;
    this.owner = env.GITHUB_OWNER || 'cloudflair';
    this.repo = env.GITHUB_REPO || 'cloudflair-web';

    this.app = new App({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      webhooks: {
        secret: env.GITHUB_WEBHOOK_SECRET,
      },
    });
  }

  async createPullRequest(
    title: string,
    body: string,
    branch: string,
    files: Array<{ path: string; content: string }>
  ): Promise<{ pr_number: number; url: string }> {
    // Get installation octokit
    const octokit = await this.getInstallationOctokit();
    
    // Get default branch
    const { data: repository } = await octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    const baseBranch = repository.default_branch;
    
    // Create new branch from base
    const { data: ref } = await octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${baseBranch}`,
    });
    
    await octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    });
    
    // Create/update files in the branch
    for (const file of files) {
      // Get current file content if exists
      let sha: string | undefined;
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: file.path,
          ref: baseBranch,
        });
        if (!Array.isArray(data) && data.type === 'file') {
          sha = data.sha;
        }
      } catch (e) {
        // File doesn't exist yet
      }
      
      // Create or update file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: file.path,
        message: `Update ${file.path} via CloudFlair agent`,
        content: Buffer.from(file.content).toString('base64'),
        branch,
        sha,
      });
    }
    
    // Create pull request
    const { data: pr } = await octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: branch,
      base: baseBranch,
      draft: false,
    });
    
    // Add labels
    await octokit.rest.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: pr.number,
      labels: ['agent-generated', 'auto-review'],
    });
    
    return {
      pr_number: pr.number,
      url: pr.html_url,
    };
  }

  async mergePullRequest(prNumber: number, commitMessage?: string): Promise<void> {
    const octokit = await this.getInstallationOctokit();
    
    await octokit.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      commit_title: commitMessage || 'Auto-merge via CloudFlair',
      merge_method: 'squash',
    });
  }

  async closePullRequest(prNumber: number): Promise<void> {
    const octokit = await this.getInstallationOctokit();
    
    await octokit.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      state: 'closed',
    });
  }

  async commentOnPullRequest(prNumber: number, comment: string): Promise<void> {
    const octokit = await this.getInstallationOctokit();
    
    await octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body: comment,
    });
  }

  async getPreviewUrl(branch: string): Promise<string> {
    // Cloudflare Pages preview URL pattern
    const projectName = this.env.CLOUDFLARE_PROJECT_NAME || 'cloudflair';
    return `https://${branch}.${projectName}.pages.dev`;
  }

  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    try {
      const result = await sign(this.env.GITHUB_WEBHOOK_SECRET, payload);
      return signature === `sha256=${result}`;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  async handleWebhook(event: string, payload: any): Promise<void> {
    switch (event) {
      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;
      case 'pull_request_review':
        await this.handleReviewEvent(payload);
        break;
      case 'issue_comment':
        await this.handleCommentEvent(payload);
        break;
      case 'push':
        await this.handlePushEvent(payload);
        break;
      default:
        console.log(`Unhandled GitHub event: ${event}`);
    }
  }

  private async handlePullRequestEvent(payload: any): Promise<void> {
    const pr = payload.pull_request;
    const action = payload.action;
    
    if (action === 'opened' && pr.labels.some((l: any) => l.name === 'agent-generated')) {
      // Auto-review agent PRs
      await this.commentOnPullRequest(
        pr.number,
        `🤖 CloudFlair Agent PR detected. Running automated checks...`
      );
      
      // Run validation checks
      // TODO: Implement PR validation logic
    }
  }

  private async handleReviewEvent(payload: any): Promise<void> {
    const review = payload.review;
    const pr = payload.pull_request;
    
    if (review.state === 'approved' && pr.labels.some((l: any) => l.name === 'auto-merge')) {
      // Auto-merge approved PRs with auto-merge label
      await this.mergePullRequest(pr.number);
    }
  }

  private async handleCommentEvent(payload: any): Promise<void> {
    const comment = payload.comment;
    const issue = payload.issue;
    
    // Check for bot commands in comments
    if (comment.body.includes('/cloudflair')) {
      const command = comment.body.split('/cloudflair')[1].trim().split(' ')[0];
      
      switch (command) {
        case 'approve':
          // Mark as approved
          break;
        case 'merge':
          // Merge the PR
          if (issue.pull_request) {
            await this.mergePullRequest(issue.number);
          }
          break;
        case 'close':
          // Close the PR
          if (issue.pull_request) {
            await this.closePullRequest(issue.number);
          }
          break;
      }
    }
  }

  private async handlePushEvent(payload: any): Promise<void> {
    // Handle push to main branch
    if (payload.ref === 'refs/heads/main') {
      console.log('Push to main branch detected, deployment will be triggered via GitHub Actions');
    }
  }

  private async getInstallationOctokit() {
    // Get installation ID (you might want to cache this)
    const installations = await this.app.octokit.rest.apps.listInstallations();
    const installation = installations.data.find(
      (i) => i.account?.login === this.owner
    );
    
    if (!installation) {
      throw new Error(`No GitHub App installation found for ${this.owner}`);
    }
    
    return this.app.getInstallationOctokit(installation.id);
  }
}

// Export a function to create PR from agent changes
export async function createContentPullRequest(
  env: Env,
  agentId: string,
  files: Array<{ path: string; content: string }>,
  reason: string
): Promise<{ pr_number: number; url: string; preview_url: string }> {
  const github = new GitHubService(env);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const branch = `agent/${agentId.toLowerCase()}/auto-${timestamp}-${Date.now()}`;
  
  const title = `[${agentId}] Content Update - ${timestamp}`;
  const body = `## 🤖 Automated Content Update

**Agent**: ${agentId}
**Reason**: ${reason}
**Timestamp**: ${new Date().toISOString()}

### Changes
${files.map(f => `- \`${f.path}\``).join('\n')}

### Preview
Preview will be available at: ${await github.getPreviewUrl(branch)}

### Review Instructions
- Check content accuracy
- Verify formatting
- Review SEO metadata
- Approve or request changes

---
*This PR was automatically generated by CloudFlair Agent System*`;
  
  const result = await github.createPullRequest(title, body, branch, files);
  
  return {
    ...result,
    preview_url: await github.getPreviewUrl(branch),
  };
}
