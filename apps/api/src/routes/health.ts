import { Hono } from 'hono';
import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';

const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/', async (c) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'production',
    version: c.env.API_VERSION || 'v1',
    checks: {
      database: 'pending',
      kv: 'pending',
      queue: 'pending',
      r2: 'pending',
    },
    uptime: process.uptime ? process.uptime() : null,
  };
  
  // Check D1 Database
  try {
    const db = drizzle(c.env.DB);
    const result = await db.select({ count: sql<number>`1` }).from(sql`sqlite_master`).limit(1);
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
  }
  
  // Check KV
  try {
    await c.env.CONFIG_KV.put('health_check', Date.now().toString(), { expirationTtl: 60 });
    const value = await c.env.CONFIG_KV.get('health_check');
    checks.checks.kv = value ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.checks.kv = 'unhealthy';
    checks.status = 'degraded';
  }
  
  // Check R2
  try {
    const testKey = `health-check-${Date.now()}.txt`;
    await c.env.ASSETS_BUCKET.put(testKey, 'health check', {
      httpMetadata: { contentType: 'text/plain' },
    });
    await c.env.ASSETS_BUCKET.delete(testKey);
    checks.checks.r2 = 'healthy';
  } catch (error) {
    checks.checks.r2 = 'unhealthy';
    checks.status = 'degraded';
  }
  
  // Check Queue (we can't directly test send without side effects, so just check binding)
  try {
    if (c.env.JOBS_QUEUE) {
      checks.checks.queue = 'healthy';
    } else {
      checks.checks.queue = 'unhealthy';
    }
  } catch (error) {
    checks.checks.queue = 'unhealthy';
    checks.status = 'degraded';
  }
  
  // Return appropriate status code
  const statusCode = checks.status === 'ok' ? 200 : 503;
  
  return c.json(checks, statusCode);
});

healthRouter.get('/live', (c) => {
  // Simple liveness probe for k8s
  return c.json({ status: 'alive' }, 200);
});

healthRouter.get('/ready', async (c) => {
  // Readiness probe - check if service is ready to handle requests
  try {
    const db = drizzle(c.env.DB);
    await db.select({ count: sql<number>`1` }).from(sql`sqlite_master`).limit(1);
    return c.json({ status: 'ready' }, 200);
  } catch (error) {
    return c.json({ status: 'not ready', error: error.message }, 503);
  }
});

export { healthRouter };
