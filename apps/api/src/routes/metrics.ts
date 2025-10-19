import { Hono } from 'hono';
import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { kpiSnapshots, agentTasks, errorSignatures, customers, subscriptions } from '../db/schema';
import { eq, sql, gte, and, desc } from 'drizzle-orm';
import { subDays } from 'date-fns';

const metricsRouter = new Hono<{ Bindings: Env }>();

// GET /metrics - Public metrics endpoint (Prometheus format)
metricsRouter.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Collect current metrics
  const metrics = [];
  
  // Get latest KPI snapshots
  const latestKpis = await db.select()
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.date, today))
    .limit(100);
  
  // Format as Prometheus metrics
  for (const kpi of latestKpis) {
    metrics.push(`# HELP cloudflair_${kpi.metric} ${kpi.metric.replace(/_/g, ' ')}`);
    metrics.push(`# TYPE cloudflair_${kpi.metric} gauge`);
    metrics.push(`cloudflair_${kpi.metric} ${kpi.value}`);
  }
  
  // Add custom metrics
  
  // Total customers
  const totalCustomers = await db.select({ count: sql<number>`count(*)` })
    .from(customers);
  metrics.push('# HELP cloudflair_customers_total Total number of customers');
  metrics.push('# TYPE cloudflair_customers_total counter');
  metrics.push(`cloudflair_customers_total ${totalCustomers[0]?.count || 0}`);
  
  // Active subscriptions
  const activeSubs = await db.select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'));
  metrics.push('# HELP cloudflair_subscriptions_active Active subscriptions');
  metrics.push('# TYPE cloudflair_subscriptions_active gauge');
  metrics.push(`cloudflair_subscriptions_active ${activeSubs[0]?.count || 0}`);
  
  // Pending agent tasks
  const pendingTasks = await db.select({ count: sql<number>`count(*)` })
    .from(agentTasks)
    .where(eq(agentTasks.status, 'pending'));
  metrics.push('# HELP cloudflair_agent_tasks_pending Pending agent tasks');
  metrics.push('# TYPE cloudflair_agent_tasks_pending gauge');
  metrics.push(`cloudflair_agent_tasks_pending ${pendingTasks[0]?.count || 0}`);
  
  // Recent errors
  const recentErrors = await db.select({ count: sql<number>`count(*)` })
    .from(errorSignatures)
    .where(
      and(
        gte(errorSignatures.lastSeenAt, subDays(now, 1)),
        eq(errorSignatures.resolved, false)
      )
    );
  metrics.push('# HELP cloudflair_errors_recent Errors in last 24 hours');
  metrics.push('# TYPE cloudflair_errors_recent gauge');
  metrics.push(`cloudflair_errors_recent ${recentErrors[0]?.count || 0}`);
  
  // Return Prometheus format
  c.header('Content-Type', 'text/plain; version=0.0.4');
  return c.text(metrics.join('\n'));
});

// GET /metrics/dashboard - Dashboard metrics JSON
metricsRouter.get('/dashboard', async (c) => {
  const db = drizzle(c.env.DB);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = subDays(now, 1).toISOString().split('T')[0];
  const lastWeek = subDays(now, 7).toISOString().split('T')[0];
  
  // Get today's metrics
  const todayMetrics = await db.select()
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.date, today))
    .limit(200);
  
  // Get yesterday's metrics for comparison
  const yesterdayMetrics = await db.select()
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.date, yesterday))
    .limit(200);
  
  // Get last 7 days for trends
  const weekMetrics = await db.select()
    .from(kpiSnapshots)
    .where(gte(kpiSnapshots.date, lastWeek))
    .orderBy(desc(kpiSnapshots.date));
  
  // Get recent agent activity
  const recentAgentActivity = await db.select()
    .from(agentTasks)
    .orderBy(desc(agentTasks.createdAt))
    .limit(10);
  
  // Get error summary
  const activeErrors = await db.select()
    .from(errorSignatures)
    .where(eq(errorSignatures.resolved, false))
    .orderBy(desc(errorSignatures.lastSeenAt))
    .limit(5);
  
  // Process metrics into categories
  const processedMetrics = {
    current: processMetrics(todayMetrics),
    previous: processMetrics(yesterdayMetrics),
    trends: calculateTrends(weekMetrics),
    agentActivity: recentAgentActivity.map(task => ({
      id: task.id,
      agent: task.agentId,
      type: task.type,
      status: task.status,
      createdAt: task.createdAt,
    })),
    errors: activeErrors.map(err => ({
      key: err.key,
      message: err.message,
      count: err.count,
      lastSeen: err.lastSeenAt,
    })),
    timestamp: now.toISOString(),
  };
  
  return c.json(processedMetrics);
});

// GET /metrics/history - Historical metrics
metricsRouter.get('/history', async (c) => {
  const metric = c.req.query('metric');
  const days = parseInt(c.req.query('days') || '30');
  
  if (!metric) {
    return c.json({ error: 'Metric parameter required' }, 400);
  }
  
  const db = drizzle(c.env.DB);
  const startDate = subDays(new Date(), days).toISOString().split('T')[0];
  
  const history = await db.select()
    .from(kpiSnapshots)
    .where(
      and(
        eq(kpiSnapshots.metric, metric),
        gte(kpiSnapshots.date, startDate)
      )
    )
    .orderBy(desc(kpiSnapshots.date));
  
  // Group by date
  const grouped = history.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = [];
    }
    acc[item.date].push(item.value);
    return acc;
  }, {} as Record<string, number[]>);
  
  // Average values per day
  const data = Object.entries(grouped).map(([date, values]) => ({
    date,
    value: values.reduce((sum, v) => sum + v, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    samples: values.length,
  }));
  
  return c.json({
    metric,
    period: `${days} days`,
    data: data.sort((a, b) => a.date.localeCompare(b.date)),
  });
});

// GET /metrics/realtime - Real-time metrics (SSE)
metricsRouter.get('/realtime', async (c) => {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  const db = drizzle(c.env.DB);
  
  // Send initial data
  const initialData = await getCurrentMetrics(db);
  c.write(`data: ${JSON.stringify(initialData)}\n\n`);
  
  // In production, this would set up a real SSE connection
  // For now, return after sending initial data
  return c.body('');
});

// Helper functions
function processMetrics(metrics: any[]): Record<string, any> {
  const processed: Record<string, any> = {};
  
  for (const metric of metrics) {
    const category = metric.metric.split('_')[0];
    if (!processed[category]) {
      processed[category] = {};
    }
    
    const key = metric.metric.replace(`${category}_`, '');
    processed[category][key] = {
      value: metric.value,
      metadata: metric.metaJson,
    };
  }
  
  return processed;
}

function calculateTrends(metrics: any[]): Record<string, any> {
  const trends: Record<string, any> = {};
  
  // Group by metric
  const grouped = metrics.reduce((acc, item) => {
    if (!acc[item.metric]) {
      acc[item.metric] = [];
    }
    acc[item.metric].push({
      date: item.date,
      value: item.value,
    });
    return acc;
  }, {} as Record<string, any[]>);
  
  // Calculate trends
  for (const [metric, values] of Object.entries(grouped)) {
    if (values.length < 2) continue;
    
    const sorted = values.sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-7);
    const previous = sorted.slice(-14, -7);
    
    const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;
    const previousAvg = previous.length > 0
      ? previous.reduce((sum, v) => sum + v.value, 0) / previous.length
      : recentAvg;
    
    const change = previousAvg !== 0
      ? ((recentAvg - previousAvg) / previousAvg) * 100
      : 0;
    
    trends[metric] = {
      current: recentAvg,
      previous: previousAvg,
      change: change.toFixed(2),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      data: recent,
    };
  }
  
  return trends;
}

async function getCurrentMetrics(db: any): Promise<any> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const latestMetrics = await db.select()
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.date, today))
    .orderBy(desc(kpiSnapshots.createdAt))
    .limit(20);
  
  return {
    timestamp: now.toISOString(),
    metrics: processMetrics(latestMetrics),
  };
}

export { metricsRouter };
