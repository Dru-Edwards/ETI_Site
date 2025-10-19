import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { bearerAuth } from 'hono/bearer-auth';

// Route imports
import { healthRouter } from './routes/health';
import { agentRouter } from './routes/agent';
import { stripeRouter } from './routes/stripe';
import { newsletterRouter } from './routes/newsletter';
import { metricsRouter } from './routes/metrics';
import { adminRouter } from './routes/admin';

// Job imports
import { handleCronTrigger } from './jobs/cron';
import { handleQueueBatch } from './jobs/queue';

// Types
export interface Env {
  // Bindings
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  REPORTS_BUCKET: R2Bucket;
  JOBS_QUEUE: Queue;
  
  // Secrets
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  BUTTONDOWN_API_KEY: string;
  CONTENTAGENT_API_KEY: string;
  SEOAGENT_API_KEY: string;
  OPSAGENT_API_KEY: string;
  COMMERCEAGENT_API_KEY: string;
  COMMUNITYAGENT_API_KEY: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  
  // Variables
  ENVIRONMENT: string;
  CORS_ORIGINS: string;
  TIMEZONE: string;
  API_VERSION: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', timing());
app.use('*', logger());
app.use('*', compress());
app.use('*', secureHeaders());

// CORS configuration
app.use('*', async (c, next) => {
  const origins = c.env.CORS_ORIGINS?.split(',') || ['https://cloudflair.com'];
  return cors({
    origin: origins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Agent-Id', 'X-Timestamp', 'X-Signature'],
    maxAge: 86400,
  })(c, next);
});

// Health check (no auth)
app.route('/health', healthRouter);

// Public metrics endpoint
app.route('/metrics', metricsRouter);

// Agent endpoints (HMAC auth)
app.route('/agent', agentRouter);

// Stripe webhooks (signature validation)
app.route('/stripe', stripeRouter);

// Newsletter endpoints
app.route('/newsletter', newsletterRouter);

// Admin endpoints (CF Access protected)
app.route('/admin', adminRouter);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'CloudFlair API',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'production',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      agent: '/agent/*',
      stripe: '/stripe/*',
      newsletter: '/newsletter/*',
      admin: '/admin/*',
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested resource does not exist',
      path: c.req.path,
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error(`Error in ${c.req.method} ${c.req.path}:`, err);
  
  // Log to error_signatures table
  const errorKey = `${err.name || 'Error'}_${c.req.path}`;
  
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : 'An unexpected error occurred',
      requestId: c.get('requestId'),
    },
    500
  );
});

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  
  // Cron handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCronTrigger(event, env));
  },
  
  // Queue handler
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleQueueBatch(batch, env));
  },
};
