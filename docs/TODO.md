# CloudFlair Setup TODOs

## 🔴 CRITICAL: Required Values & Commands

### 1. Cloudflare Account Setup
Replace these placeholders in configuration files:
- [ ] **Cloudflare Account ID**: `<CF_ACCOUNT_ID>`
  - Location: `apps/api/wrangler.toml`, GitHub Actions secrets
  - Get from: https://dash.cloudflare.com → Your Account → Account ID

### 2. Cloudflare Resources (Run these commands after installing wrangler)
```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 Database
wrangler d1 create cloudflair-db
# Copy the database_id from output and replace in apps/api/wrangler.toml

# Create KV Namespace for config/flags
wrangler kv:namespace create CONFIG_KV
# Copy the id from output and replace in apps/api/wrangler.toml

# Create KV Namespace for preview
wrangler kv:namespace create CONFIG_KV --preview
# Copy the preview_id from output and replace in apps/api/wrangler.toml

# Create Queue
wrangler queues create cloudflair-jobs

# Create R2 Buckets
wrangler r2 bucket create cloudflair-assets
wrangler r2 bucket create cloudflair-reports
```

### 3. Secrets Configuration (After creating resources)
```bash
# Stripe Keys (test mode)
wrangler secret put STRIPE_SECRET_KEY
# Enter your Stripe test secret key (starts with sk_test_)

wrangler secret put STRIPE_WEBHOOK_SECRET
# Enter your Stripe webhook signing secret (get after creating webhook endpoint)

# Email Provider (Resend)
wrangler secret put RESEND_API_KEY
# Get from: https://resend.com/api-keys

# Newsletter Provider (Buttondown)
wrangler secret put BUTTONDOWN_API_KEY
# Get from: https://buttondown.email/settings/api

# Agent API Keys (generate secure random strings)
wrangler secret put CONTENTAGENT_API_KEY
# Generate: openssl rand -hex 32

wrangler secret put SEOAGENT_API_KEY
# Generate: openssl rand -hex 32

wrangler secret put OPSAGENT_API_KEY
# Generate: openssl rand -hex 32

wrangler secret put COMMERCEAGENT_API_KEY
# Generate: openssl rand -hex 32

wrangler secret put COMMUNITYAGENT_API_KEY
# Generate: openssl rand -hex 32

# GitHub App
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
wrangler secret put GITHUB_WEBHOOK_SECRET
# Get these after creating GitHub App (see section 4)
```

### 4. GitHub Setup
1. **Create Repository**:
   ```bash
   gh repo create cloudflair/cloudflair-web --private
   git init
   git remote add origin https://github.com/cloudflair/cloudflair-web.git
   ```

2. **Create GitHub App**:
   - Go to: https://github.com/settings/apps/new
   - Use manifest from: `infra/github/app-manifest.json`
   - Install on your organization/repository
   - Save App ID and generate private key

3. **Repository Secrets** (for GitHub Actions):
   ```bash
   gh secret set CF_ACCOUNT_ID
   gh secret set CF_API_TOKEN
   gh secret set STRIPE_SECRET_KEY
   gh secret set RESEND_API_KEY
   gh secret set BUTTONDOWN_API_KEY
   ```

### 5. Domain & DNS Configuration
- [ ] Register domain at Cloudflare Registrar or transfer existing
- [ ] Configure DNS records:
  ```
  Type    Name    Content              Proxied
  CNAME   @       cloudflair.pages.dev Yes
  CNAME   www     cloudflair.pages.dev Yes
  CNAME   api     cloudflair.workers.dev Yes
  ```

### 6. Cloudflare Access Setup (for Admin Dashboard)
1. Go to Zero Trust → Access → Applications
2. Create new application:
   - Name: CloudFlair Admin
   - Path: `admin.cloudflair.com/*`
3. Add policy:
   - Name: Admin Access
   - Action: Allow
   - Include: Email is `ops@cloudflair.com` (add more emails as needed)

### 7. Stripe Configuration
1. **Test Mode Setup**:
   - Go to: https://dashboard.stripe.com/test/apikeys
   - Copy secret key for `STRIPE_SECRET_KEY`
   
2. **Create Products** (in test mode):
   - Basic Plan: $29/month
   - Pro Plan: $99/month
   - Enterprise Plan: $299/month
   
3. **Webhook Endpoint**:
   - URL: `https://api.cloudflair.com/stripe/webhook`
   - Events to listen:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy signing secret for `STRIPE_WEBHOOK_SECRET`

### 8. Environment Variables (Local Development)
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
CONTENTAGENT_API_KEY=...
SEOAGENT_API_KEY=...
OPSAGENT_API_KEY=...
COMMERCEAGENT_API_KEY=...
COMMUNITYAGENT_API_KEY=...
```

### 9. First Deployment
```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm -F api migrate:apply

# Deploy to Cloudflare
pnpm -F web deploy
pnpm -F api deploy
```

### 10. Post-Deployment Verification
- [ ] Visit https://cloudflair.com - should show homepage
- [ ] Test /health endpoint: `curl https://api.cloudflair.com/health`
- [ ] Verify admin access at https://cloudflair.com/admin
- [ ] Test newsletter signup with Turnstile
- [ ] Create test Stripe checkout session
- [ ] Verify daily report cron (wait until 6:30 AM CT or trigger manually)

## 📝 Optional Enhancements
- [ ] Sentry DSN for error tracking
- [ ] Terraform configuration for infrastructure as code
- [ ] Custom email domain with Cloudflare Email Routing
- [ ] Cloudflare Analytics Engine for custom metrics

## 🎯 Default Values Being Used
These can be changed later:
- **Brand**: CloudFlair
- **Domain**: cloudflair.com
- **Newsletter**: Buttondown
- **Email Sender**: Resend
- **Ops Email**: ops@cloudflair.com
- **GitHub Repo**: cloudflair/cloudflair-web
- **Timezone**: America/Chicago

## 📚 References
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Resend Documentation](https://resend.com/docs)
- [Buttondown API](https://api.buttondown.email/v1/docs)
