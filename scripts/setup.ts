#!/usr/bin/env node
/**
 * CloudFlair Setup Script
 * Run this to initialize the project after cloning
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import chalk from 'chalk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

interface SetupConfig {
  cloudflareAccountId?: string;
  domain?: string;
  opsEmail?: string;
  stripePublishableKey?: string;
  turnstileSiteKey?: string;
  environment: 'development' | 'production';
}

class CloudFlairSetup {
  private config: SetupConfig = {
    environment: 'development',
  };
  
  async run() {
    console.log(chalk.blue.bold('\n🚀 CloudFlair Setup Wizard\n'));
    
    // Check prerequisites
    await this.checkPrerequisites();
    
    // Gather configuration
    await this.gatherConfig();
    
    // Install dependencies
    await this.installDependencies();
    
    // Create environment files
    await this.createEnvFiles();
    
    // Create Cloudflare resources
    await this.setupCloudflare();
    
    // Run database migrations
    await this.setupDatabase();
    
    // Generate agent keys
    await this.generateAgentKeys();
    
    console.log(chalk.green.bold('\n✅ Setup complete!\n'));
    console.log(chalk.yellow('Next steps:'));
    console.log('1. Review and update configuration in .env files');
    console.log('2. Configure secrets with: pnpm run setup:secrets');
    console.log('3. Start development: pnpm dev');
    console.log('4. Deploy to production: pnpm deploy');
    
    rl.close();
  }
  
  private async checkPrerequisites() {
    console.log(chalk.cyan('Checking prerequisites...'));
    
    // Check Node version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (major < 18) {
      console.error(chalk.red(`❌ Node.js 18+ required (found ${nodeVersion})`));
      process.exit(1);
    }
    
    // Check pnpm
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      console.log(chalk.green('✓ pnpm found'));
    } catch {
      console.log(chalk.yellow('Installing pnpm...'));
      execSync('npm install -g pnpm', { stdio: 'inherit' });
    }
    
    // Check wrangler
    try {
      execSync('wrangler --version', { stdio: 'ignore' });
      console.log(chalk.green('✓ wrangler found'));
    } catch {
      console.log(chalk.yellow('Installing wrangler...'));
      execSync('npm install -g wrangler', { stdio: 'inherit' });
    }
    
    console.log(chalk.green('✓ Prerequisites check passed\n'));
  }
  
  private async gatherConfig() {
    console.log(chalk.cyan('Configuration Setup\n'));
    
    this.config.cloudflareAccountId = await question(
      'Cloudflare Account ID (leave empty to set later): '
    );
    
    this.config.domain = await question(
      'Primary domain (default: cloudflair.com): '
    ) || 'cloudflair.com';
    
    this.config.opsEmail = await question(
      `Operations email (default: ops@${this.config.domain}): `
    ) || `ops@${this.config.domain}`;
    
    const isProd = await question(
      'Setup for production? (y/N): '
    );
    this.config.environment = isProd.toLowerCase() === 'y' ? 'production' : 'development';
    
    console.log(chalk.green('\n✓ Configuration gathered'));
  }
  
  private async installDependencies() {
    console.log(chalk.cyan('\nInstalling dependencies...'));
    
    try {
      execSync('pnpm install', { stdio: 'inherit' });
      console.log(chalk.green('✓ Dependencies installed'));
    } catch (error) {
      console.error(chalk.red('Failed to install dependencies'));
      throw error;
    }
  }
  
  private async createEnvFiles() {
    console.log(chalk.cyan('\nCreating environment files...'));
    
    // Create apps/web/.env.local
    const webEnv = `# CloudFlair Web Environment
NEXT_PUBLIC_API_URL=${this.config.environment === 'production' ? 
  `https://api.${this.config.domain}` : 
  'http://localhost:8787'}
NEXT_PUBLIC_SITE_URL=${this.config.environment === 'production' ? 
  `https://${this.config.domain}` : 
  'http://localhost:3000'}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${this.config.stripePublishableKey || 'pk_test_PLACEHOLDER'}
NEXT_PUBLIC_TURNSTILE_SITE_KEY=${this.config.turnstileSiteKey || 'PLACEHOLDER'}
`;
    
    writeFileSync(join(process.cwd(), 'apps/web/.env.local'), webEnv);
    console.log(chalk.green('✓ Created apps/web/.env.local'));
    
    // Create apps/api/.dev.vars
    const apiVars = `# CloudFlair API Development Variables
# Add your secrets here (DO NOT COMMIT)
STRIPE_SECRET_KEY=sk_test_PLACEHOLDER
STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER
RESEND_API_KEY=re_PLACEHOLDER
BUTTONDOWN_API_KEY=PLACEHOLDER
TURNSTILE_SECRET_KEY=PLACEHOLDER

# Agent API Keys (will be generated)
CONTENTAGENT_API_KEY=PLACEHOLDER
SEOAGENT_API_KEY=PLACEHOLDER
OPSAGENT_API_KEY=PLACEHOLDER
COMMERCEAGENT_API_KEY=PLACEHOLDER
COMMUNITYAGENT_API_KEY=PLACEHOLDER

# GitHub App
GITHUB_APP_ID=PLACEHOLDER
GITHUB_APP_PRIVATE_KEY=PLACEHOLDER
GITHUB_WEBHOOK_SECRET=PLACEHOLDER
`;
    
    writeFileSync(join(process.cwd(), 'apps/api/.dev.vars'), apiVars);
    console.log(chalk.green('✓ Created apps/api/.dev.vars'));
  }
  
  private async setupCloudflare() {
    if (!this.config.cloudflareAccountId) {
      console.log(chalk.yellow('\n⚠️  Skipping Cloudflare setup (no account ID)'));
      console.log('Run the following commands manually:');
      console.log(chalk.gray('  wrangler d1 create cloudflair-db'));
      console.log(chalk.gray('  wrangler kv:namespace create CONFIG_KV'));
      console.log(chalk.gray('  wrangler queues create cloudflair-jobs'));
      console.log(chalk.gray('  wrangler r2 bucket create cloudflair-assets'));
      console.log(chalk.gray('  wrangler r2 bucket create cloudflair-reports'));
      return;
    }
    
    console.log(chalk.cyan('\nSetting up Cloudflare resources...'));
    
    try {
      // Login to Cloudflare
      console.log('Logging in to Cloudflare...');
      execSync('wrangler login', { stdio: 'inherit' });
      
      // Create D1 Database
      console.log('Creating D1 database...');
      const d1Output = execSync('wrangler d1 create cloudflair-db', { encoding: 'utf-8' });
      const databaseId = d1Output.match(/database_id = "([^"]+)"/)?.[1];
      if (databaseId) {
        this.updateWranglerConfig('database_id', databaseId);
      }
      
      // Create KV Namespaces
      console.log('Creating KV namespaces...');
      const kvOutput = execSync('wrangler kv:namespace create CONFIG_KV', { encoding: 'utf-8' });
      const kvId = kvOutput.match(/id = "([^"]+)"/)?.[1];
      if (kvId) {
        this.updateWranglerConfig('kv_namespace_id', kvId);
      }
      
      // Create Queue
      console.log('Creating queue...');
      execSync('wrangler queues create cloudflair-jobs', { stdio: 'inherit' });
      
      // Create R2 Buckets
      console.log('Creating R2 buckets...');
      execSync('wrangler r2 bucket create cloudflair-assets', { stdio: 'inherit' });
      execSync('wrangler r2 bucket create cloudflair-reports', { stdio: 'inherit' });
      
      console.log(chalk.green('✓ Cloudflare resources created'));
    } catch (error) {
      console.error(chalk.red('Failed to create Cloudflare resources'));
      console.log(chalk.yellow('Please create them manually'));
    }
  }
  
  private updateWranglerConfig(key: string, value: string) {
    const configPath = join(process.cwd(), 'apps/api/wrangler.toml');
    let config = readFileSync(configPath, 'utf-8');
    
    if (key === 'database_id') {
      config = config.replace(
        /database_id = "<REPLACE_WITH_D1_DATABASE_ID>"/,
        `database_id = "${value}"`
      );
    } else if (key === 'kv_namespace_id') {
      config = config.replace(
        /id = "<REPLACE_WITH_KV_NAMESPACE_ID>"/,
        `id = "${value}"`
      );
    }
    
    if (this.config.cloudflareAccountId) {
      config = config.replace(
        /account_id = "<CF_ACCOUNT_ID>"/,
        `account_id = "${this.config.cloudflareAccountId}"`
      );
    }
    
    writeFileSync(configPath, config);
  }
  
  private async setupDatabase() {
    console.log(chalk.cyan('\nSetting up database...'));
    
    try {
      // Generate migrations
      console.log('Generating migrations...');
      execSync('pnpm -F api migrate:create', { stdio: 'inherit' });
      
      // Apply migrations locally
      if (this.config.environment === 'development') {
        console.log('Applying migrations locally...');
        execSync('pnpm -F api migrate:apply', { stdio: 'inherit' });
      }
      
      console.log(chalk.green('✓ Database setup complete'));
    } catch (error) {
      console.error(chalk.yellow('⚠️  Database setup failed - run manually later'));
    }
  }
  
  private async generateAgentKeys() {
    console.log(chalk.cyan('\nGenerating agent API keys...'));
    
    const agents = [
      'CONTENTAGENT',
      'SEOAGENT',
      'OPSAGENT',
      'COMMERCEAGENT',
      'COMMUNITYAGENT',
    ];
    
    const keys: Record<string, string> = {};
    
    for (const agent of agents) {
      // Generate a secure random key
      const key = Array.from({ length: 32 }, () => 
        Math.random().toString(36).charAt(2)
      ).join('');
      
      keys[`${agent}_API_KEY`] = key;
      console.log(chalk.gray(`  Generated key for ${agent}`));
    }
    
    // Update .dev.vars with generated keys
    const varsPath = join(process.cwd(), 'apps/api/.dev.vars');
    let varsContent = readFileSync(varsPath, 'utf-8');
    
    for (const [name, key] of Object.entries(keys)) {
      varsContent = varsContent.replace(
        new RegExp(`${name}=PLACEHOLDER`),
        `${name}=${key}`
      );
    }
    
    writeFileSync(varsPath, varsContent);
    
    // Create a secure keys file
    const keysContent = `# CloudFlair Agent API Keys
# Generated: ${new Date().toISOString()}
# KEEP THIS FILE SECURE - DO NOT COMMIT

${Object.entries(keys).map(([name, key]) => `${name}=${key}`).join('\n')}

# To set these as Cloudflare secrets, run:
${Object.entries(keys).map(([name, key]) => 
  `# echo "${key}" | wrangler secret put ${name}`
).join('\n')}
`;
    
    writeFileSync(join(process.cwd(), 'agent-keys.txt'), keysContent);
    console.log(chalk.green('✓ Agent keys generated (saved to agent-keys.txt)'));
    console.log(chalk.yellow('  ⚠️  Keep agent-keys.txt secure and do not commit it'));
  }
}

// Run setup
const setup = new CloudFlairSetup();
setup.run().catch((error) => {
  console.error(chalk.red('\n❌ Setup failed:'), error);
  process.exit(1);
});
