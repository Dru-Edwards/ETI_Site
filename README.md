# CloudFlair - Cloudflare-Native Web Stack with Agent Automation

**Version:** 1.0.0  
**Status:** Phase A (Scaffolding) Complete ✅

CloudFlair is a production-grade, Cloudflare-native web platform with integrated agent automation, designed for 90% autonomous management through safe, PR-first workflows.

## 🚀 Features

### Core Platform
- **Marketing Website**: Fast, SEO-optimized Next.js site on Cloudflare Pages
- **Stripe Commerce**: Checkout, subscriptions, and customer portal integration
- **Newsletter System**: Buttondown integration with archive pages
- **Event Management**: Calendar system with ICS feeds
- **Admin Dashboard**: KPI monitoring and agent control panel

### Agent Control Plane (ACP)
- **5 Specialized Agents**: Content, SEO, Ops, Commerce, Community
- **PR-First Workflows**: All content changes via GitHub PRs
- **HMAC Authentication**: Secure agent-to-API communication
- **Risk-Based Approval**: Auto-approve low-risk, gate high-risk actions
- **Full Audit Trail**: Every agent action logged in D1

### Daily Executive Email
- **Automated Reports**: 6:30 AM CT daily
- **Comprehensive KPIs**: Traffic, revenue, performance, agent activity
- **Risk Analysis**: Top 3 risks with recommendations
- **Markdown Archive**: Reports stored in R2 for historical analysis

### Infrastructure
- **Cloudflare Pages**: Edge-optimized web hosting
- **Cloudflare Workers**: Serverless API with Hono
- **D1 Database**: SQLite at the edge with Drizzle ORM
- **KV Storage**: Feature flags and configuration
- **R2 Storage**: Assets and report archives
- **Queue System**: Background job processing
- **Cron Triggers**: Scheduled tasks and reports

## 📁 Project Structure

```
CloudFlair/
├── apps/
│   ├── web/                 # Next.js marketing site
│   └── api/                 # Hono API on Workers
├── packages/
│   ├── ui/                  # Shared UI components
│   └── lib/                 # Shared utilities
├── agents/                  # Agent client libraries
│   ├── python/             # Python agent SDK
│   └── node/               # Node.js agent SDK
├── scripts/
│   └── integrate-agents.ts  # Agent integration script
├── docs/
│   └── TODO.md             # Setup checklist
└── agents.config.yaml      # Agent configuration
```

## 🛠️ Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Cloudflare Account** with Workers paid plan
- **Stripe Account** (test mode initially)
- **GitHub Account** for repository and GitHub App
- **Domain** registered with Cloudflare
- **Agent Template Package** at `C:\Users\Mrdru\OneDrive\Documents\Projects\AI_Projects\AGENT_TEMPLATE_PACKAGE`

## 📦 Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/cloudflair/cloudflair-web.git
cd cloudflair-web

# Install dependencies
pnpm install

# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Create Cloudflare Resources

```bash
# Create D1 Database
wrangler d1 create cloudflair-db
# Copy the database_id and update apps/api/wrangler.toml

# Create KV Namespaces
wrangler kv:namespace create CONFIG_KV
wrangler kv:namespace create CONFIG_KV --preview
# Copy the ids and update apps/api/wrangler.toml

# Create Queue
wrangler queues create cloudflair-jobs

# Create R2 Buckets
wrangler r2 bucket create cloudflair-assets
wrangler r2 bucket create cloudflair-reports
```

### 3. Configure Secrets

```bash
# Navigate to API directory
cd apps/api

# Stripe Keys (get from https://dashboard.stripe.com/test/apikeys)
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET

# Email Service (Resend)
wrangler secret put RESEND_API_KEY

# Newsletter Service (Buttondown)
wrangler secret put BUTTONDOWN_API_KEY

# Agent API Keys (generate secure keys)
wrangler secret put CONTENTAGENT_API_KEY
wrangler secret put SEOAGENT_API_KEY
wrangler secret put OPSAGENT_API_KEY
wrangler secret put COMMERCEAGENT_API_KEY
wrangler secret put COMMUNITYAGENT_API_KEY

# GitHub App (create at https://github.com/settings/apps/new)
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
wrangler secret put GITHUB_WEBHOOK_SECRET
```

### 4. Set Up Database

```bash
# Run migrations
cd apps/api
pnpm migrate:create
pnpm migrate:apply        # Local
pnpm migrate:apply:remote  # Production
```

### 5. Configure Environment Variables

Create `.env.local` in `apps/web/`:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
```

Create `.dev.vars` in `apps/api/`:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
BUTTONDOWN_API_KEY=...
# Agent keys...
```

## 🏃 Development

### Start Local Development

```bash
# Terminal 1: Start API
cd apps/api
pnpm dev

# Terminal 2: Start Web
cd apps/web
pnpm dev

# Terminal 3: Start UI development
cd packages/ui
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:8787
- Admin: http://localhost:3000/admin

### Integrate with Agent Template Package

```bash
# Run integration script
pnpm tsx scripts/integrate-agents.ts

# Install agent clients
cd agents/python
pip install -r requirements.txt

cd ../node
npm install
```

## 🚢 Deployment

### Manual Deployment

```bash
# Deploy API to Cloudflare Workers
cd apps/api
pnpm deploy

# Deploy Web to Cloudflare Pages
cd apps/web
pnpm deploy
```

### GitHub Actions (Automatic)

Push to `main` branch triggers automatic deployment:
- CI runs tests, linting, and Lighthouse audits
- Deploy workflow pushes to Cloudflare
- Preview deployments on PRs

## 🤖 Agent Integration

### Using Python Agents

```python
from cloudflair_agent import ContentAgent, SEOAgent, OpsAgent

# Initialize agents
content = ContentAgent(api_key="your-key")
seo = SEOAgent(api_key="your-key")
ops = OpsAgent(api_key="your-key")

# Propose content
response = content.propose_content(
    path="blog/new-post.mdx",
    markdown="# New Post\n\nContent here...",
    reason="Weekly blog update",
    metadata={"tags": ["news"], "author": "ContentAgent"}
)

# Run SEO audit
audit = seo.run_audit(urls=["https://cloudflair.com"])

# Queue background task
task = ops.queue_task(
    task_type="analytics_snapshot",
    payload={"metrics": ["traffic", "conversions"]},
    priority=8
)
```

### Using Node.js Agents

```typescript
import { ContentAgent, SEOAgent, OpsAgent } from '@cloudflair/agent-client';

// Initialize agents
const content = new ContentAgent(process.env.CONTENTAGENT_API_KEY);
const seo = new SEOAgent(process.env.SEOAGENT_API_KEY);
const ops = new OpsAgent(process.env.OPSAGENT_API_KEY);

// Use agents
await content.proposeContent('blog/post.mdx', '# Content', 'reason');
await seo.runAudit(['https://cloudflair.com']);
await ops.queueTask('task_type', { data: 'payload' });
```

## 📊 Admin Dashboard

Access the admin dashboard at `https://cloudflair.com/admin` (protected by Cloudflare Access).

### Features
- **KPI Dashboard**: Real-time metrics and trends
- **Agent Queue**: Review and approve pending agent actions
- **Feature Flags**: Toggle features without deployment
- **Audit Trail**: Complete history of all agent actions
- **Order Management**: View customers and subscriptions

## 📧 Daily Reports

Automated daily reports are sent at 6:30 AM CT containing:
- Traffic analytics from Cloudflare
- Commerce metrics from Stripe
- Agent activity summary
- Performance and reliability metrics
- Top risks and recommendations

Reports are also archived in R2 at `reports/YYYY/MM/DD.md`.

## 🔒 Security

- **HMAC Authentication**: All agent requests are signed
- **Cloudflare Access**: Admin routes protected by Zero Trust
- **Rate Limiting**: Built-in rate limits per agent
- **Audit Logging**: All actions logged to D1
- **Secret Management**: Sensitive data in Workers secrets
- **CSP Headers**: Strict Content Security Policy

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [Agent Configuration](docs/agents.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Security & Compliance](docs/security.md)
- [TODO List](docs/TODO.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific workspace tests
pnpm -F api test
pnpm -F web test
pnpm -F lib test

# Run type checking
pnpm typecheck

# Run linting
pnpm lint
```

## 📈 Monitoring

- **Health Check**: `https://api.cloudflair.com/health`
- **Metrics**: `https://api.cloudflair.com/metrics`
- **Lighthouse CI**: Automated on PRs
- **Error Tracking**: Errors logged to D1 `error_signatures` table
- **Uptime Monitoring**: Hourly checks via cron

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

Agent-created PRs follow the pattern: `agent/{AgentName}/auto-{date}`

## 📄 License

Proprietary - CloudFlair © 2025

## 🆘 Support

- **Documentation**: See `docs/` directory
- **Issues**: GitHub Issues
- **Email**: ops@cloudflair.com
- **Admin Dashboard**: https://cloudflair.com/admin

## 🚦 Current Status

### ✅ Completed (Phase A)
- Project scaffolding
- Database schema
- Agent authentication
- API structure
- CI/CD workflows
- Integration scripts

### 🚧 Next Steps
1. Complete remaining API routes
2. Build web app UI components
3. Implement GitHub App bot
4. Add Stripe product configuration
5. Deploy to Cloudflare
6. Run acceptance tests

See [docs/TODO.md](docs/TODO.md) for detailed setup checklist.

---

**Built with** ❤️ **using Cloudflare's global network and integrated with the Agent Template Package**
