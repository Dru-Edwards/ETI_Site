import { Hono } from 'hono';
import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { agentChanges, agentTasks, customers, subscriptions, orders, kpiSnapshots, featureFlags } from '../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { nanoid } from 'nanoid';

const adminRouter = new Hono<{ Bindings: Env }>();

// Note: These routes should be protected by Cloudflare Access
// Configure at: https://dash.cloudflare.com/zero-trust/access

// GET /admin/dashboard - Main dashboard data
adminRouter.get('/dashboard', async (c) => {
  const db = drizzle(c.env.DB);
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  
  // Get summary statistics
  const [
    totalCustomers,
    activeSubscriptions,
    monthlyRevenue,
    pendingApprovals,
    recentErrors,
    agentActivity,
  ] = await Promise.all([
    // Total customers
    db.select({ count: sql<number>`count(*)` }).from(customers),
    
    // Active subscriptions
    db.select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active')),
    
    // Monthly revenue (sum of active subscription amounts)
    db.select({ 
      total: sql<number>`sum(json_extract(metadata, '$.monthlyAmount'))` 
    })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active')),
    
    // Pending agent approvals
    db.select({ count: sql<number>`count(*)` })
      .from(agentChanges)
      .where(eq(agentChanges.status, 'pending')),
    
    // Recent errors (last 24 hours)
    db.select({ count: sql<number>`count(*)` })
      .from(errorSignatures)
      .where(gte(errorSignatures.lastSeenAt, subDays(now, 1))),
    
    // Agent activity (last 30 days)
    db.select({
      agentId: agentTasks.agentId,
      count: sql<number>`count(*)`,
    })
      .from(agentTasks)
      .where(gte(agentTasks.createdAt, thirtyDaysAgo))
      .groupBy(agentTasks.agentId),
  ]);
  
  // Get recent KPIs
  const recentKpis = await db.select()
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.date, now.toISOString().split('T')[0]))
    .limit(50);
  
  // Get recent orders
  const recentOrders = await db.select({
    id: orders.id,
    customerId: orders.customerId,
    customerEmail: customers.email,
    amount: orders.amountCents,
    currency: orders.currency,
    status: orders.status,
    createdAt: orders.createdAt,
  })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orders.createdAt))
    .limit(10);
  
  return c.json({
    summary: {
      customers: totalCustomers[0]?.count || 0,
      activeSubscriptions: activeSubscriptions[0]?.count || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      pendingApprovals: pendingApprovals[0]?.count || 0,
      recentErrors: recentErrors[0]?.count || 0,
    },
    agentActivity: agentActivity.reduce((acc, item) => {
      acc[item.agentId] = item.count;
      return acc;
    }, {} as Record<string, number>),
    kpis: processKpis(recentKpis),
    recentOrders: recentOrders.map(order => ({
      ...order,
      amount: order.amount / 100, // Convert cents to dollars
    })),
    timestamp: now.toISOString(),
  });
});

// GET /admin/approvals - Pending agent approvals
adminRouter.get('/approvals', async (c) => {
  const db = drizzle(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  
  const [pendingChanges, totalCount] = await Promise.all([
    db.select()
      .from(agentChanges)
      .where(eq(agentChanges.status, 'pending'))
      .orderBy(desc(agentChanges.createdAt))
      .limit(limit)
      .offset(offset),
    
    db.select({ count: sql<number>`count(*)` })
      .from(agentChanges)
      .where(eq(agentChanges.status, 'pending')),
  ]);
  
  return c.json({
    approvals: pendingChanges.map(change => ({
      id: change.id,
      agentId: change.agentId,
      action: change.action,
      payload: change.payload,
      riskLevel: change.riskLevel,
      createdAt: change.createdAt,
      diff: generateDiff(change),
    })),
    pagination: {
      page,
      limit,
      total: totalCount[0]?.count || 0,
      hasMore: offset + limit < (totalCount[0]?.count || 0),
    },
  });
});

// POST /admin/approvals/:id/approve
adminRouter.post('/approvals/:id/approve', async (c) => {
  const changeId = c.req.param('id');
  const body = await c.req.json<{ comment?: string }>();
  
  const db = drizzle(c.env.DB);
  
  // Get the change
  const change = await db.select()
    .from(agentChanges)
    .where(eq(agentChanges.id, changeId))
    .limit(1);
  
  if (change.length === 0) {
    return c.json({ error: 'Change not found' }, 404);
  }
  
  if (change[0].status !== 'pending') {
    return c.json({ error: 'Change already processed' }, 400);
  }
  
  // Update status
  await db.update(agentChanges)
    .set({
      status: 'approved',
      approvedBy: 'admin', // In production, get from auth context
      approvedAt: new Date(),
    })
    .where(eq(agentChanges.id, changeId));
  
  // Execute the change
  await executeAgentChange(change[0], c.env, db);
  
  return c.json({
    message: 'Change approved and executed',
    id: changeId,
  });
});

// POST /admin/approvals/:id/reject
adminRouter.post('/approvals/:id/reject', async (c) => {
  const changeId = c.req.param('id');
  const body = await c.req.json<{ reason: string }>();
  
  const db = drizzle(c.env.DB);
  
  // Update status
  await db.update(agentChanges)
    .set({
      status: 'rejected',
      approvedBy: 'admin',
      approvedAt: new Date(),
      error: body.reason,
    })
    .where(eq(agentChanges.id, changeId));
  
  return c.json({
    message: 'Change rejected',
    id: changeId,
  });
});

// GET /admin/flags - Feature flags management
adminRouter.get('/flags', async (c) => {
  const db = drizzle(c.env.DB);
  
  // Get all current flags from KV
  const flags = await c.env.CONFIG_KV.list();
  
  // Get recent flag changes from DB
  const recentChanges = await db.select()
    .from(featureFlags)
    .orderBy(desc(featureFlags.createdAt))
    .limit(20);
  
  // Fetch flag values
  const currentFlags = await Promise.all(
    flags.keys.map(async (key) => {
      const value = await c.env.CONFIG_KV.get(key.name);
      return {
        key: key.name,
        value: value ? JSON.parse(value) : null,
        metadata: key.metadata,
      };
    })
  );
  
  return c.json({
    flags: currentFlags,
    history: recentChanges,
  });
});

// PUT /admin/flags/:key
adminRouter.put('/flags/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json<{ value: any; reason: string }>();
  
  const db = drizzle(c.env.DB);
  
  // Get previous value
  const previousValue = await c.env.CONFIG_KV.get(key);
  
  // Update flag
  await c.env.CONFIG_KV.put(key, JSON.stringify(body.value));
  
  // Log change
  await db.insert(featureFlags).values({
    id: nanoid(),
    key,
    value: body.value,
    previousValue: previousValue ? JSON.parse(previousValue) : null,
    changedBy: 'admin',
    changeReason: body.reason,
  });
  
  return c.json({
    message: 'Flag updated',
    key,
    value: body.value,
  });
});

// GET /admin/customers
adminRouter.get('/customers', async (c) => {
  const db = drizzle(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;
  
  const [customerList, totalCount] = await Promise.all([
    db.select({
      customer: customers,
      subscription: subscriptions,
    })
      .from(customers)
      .leftJoin(subscriptions, eq(customers.id, subscriptions.customerId))
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset),
    
    db.select({ count: sql<number>`count(*)` }).from(customers),
  ]);
  
  // Group subscriptions by customer
  const groupedCustomers = customerList.reduce((acc, row) => {
    const customerId = row.customer.id;
    if (!acc[customerId]) {
      acc[customerId] = {
        ...row.customer,
        subscriptions: [],
      };
    }
    if (row.subscription) {
      acc[customerId].subscriptions.push(row.subscription);
    }
    return acc;
  }, {} as Record<string, any>);
  
  return c.json({
    customers: Object.values(groupedCustomers),
    pagination: {
      page,
      limit,
      total: totalCount[0]?.count || 0,
      hasMore: offset + limit < (totalCount[0]?.count || 0),
    },
  });
});

// GET /admin/audit
adminRouter.get('/audit', async (c) => {
  const db = drizzle(c.env.DB);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '100');
  const agentId = c.req.query('agent');
  const offset = (page - 1) * limit;
  
  let query = db.select()
    .from(agentChanges)
    .orderBy(desc(agentChanges.createdAt))
    .limit(limit)
    .offset(offset);
  
  if (agentId) {
    query = query.where(eq(agentChanges.agentId, agentId));
  }
  
  const auditLog = await query;
  
  return c.json({
    entries: auditLog,
    pagination: {
      page,
      limit,
      hasMore: auditLog.length === limit,
    },
  });
});

// GET /admin/errors
adminRouter.get('/errors', async (c) => {
  const db = drizzle(c.env.DB);
  
  const errors = await db.select()
    .from(errorSignatures)
    .where(eq(errorSignatures.resolved, false))
    .orderBy(desc(errorSignatures.lastSeenAt))
    .limit(50);
  
  return c.json({
    errors: errors.map(err => ({
      id: err.id,
      key: err.key,
      message: err.message,
      count: err.count,
      firstSeen: err.firstSeenAt,
      lastSeen: err.lastSeenAt,
      stack: err.stack,
      metadata: err.metadata,
    })),
  });
});

// POST /admin/errors/:id/resolve
adminRouter.post('/errors/:id/resolve', async (c) => {
  const errorId = c.req.param('id');
  const db = drizzle(c.env.DB);
  
  await db.update(errorSignatures)
    .set({ resolved: true })
    .where(eq(errorSignatures.id, errorId));
  
  return c.json({ message: 'Error marked as resolved' });
});

// Helper functions
function processKpis(kpis: any[]): Record<string, any> {
  const processed: Record<string, any> = {};
  
  for (const kpi of kpis) {
    const [category, ...rest] = kpi.metric.split('_');
    const metricName = rest.join('_');
    
    if (!processed[category]) {
      processed[category] = {};
    }
    
    processed[category][metricName] = kpi.value;
  }
  
  return processed;
}

function generateDiff(change: any): string {
  // Generate a diff view for the change
  // This would be more sophisticated in production
  if (change.action === 'content_proposal') {
    return `New content at: ${change.payload?.path}`;
  } else if (change.action === 'flag_change') {
    return `Flag ${change.payload?.flagKey}: ${JSON.stringify(change.payload?.value)}`;
  }
  return JSON.stringify(change.payload, null, 2);
}

async function executeAgentChange(change: any, env: Env, db: any): Promise<void> {
  // Execute the approved change
  if (change.action === 'content_proposal') {
    // Create GitHub PR
    // TODO: Implement GitHub API call
    console.log('Would create PR for content:', change.payload);
  } else if (change.action === 'flag_change') {
    // Apply flag change
    await env.CONFIG_KV.put(
      change.payload.flagKey,
      JSON.stringify(change.payload.value)
    );
  }
  
  // Mark as executed
  await db.update(agentChanges)
    .set({
      status: 'executed',
      executedAt: new Date(),
    })
    .where(eq(agentChanges.id, change.id));
}

export { adminRouter };
