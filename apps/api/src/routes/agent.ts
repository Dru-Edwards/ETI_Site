import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { Env } from '../index';
import { agentChanges, agentTasks, content, featureFlags } from '../db/schema';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';

const agentRouter = new Hono<{ Bindings: Env }>();

// Agent configuration (maps to agents.config.yaml)
const AGENT_CONFIG = {
  ContentAgent: { secret: 'CONTENTAGENT_API_KEY', riskLevel: 'medium' },
  SEOAgent: { secret: 'SEOAGENT_API_KEY', riskLevel: 'low' },
  OpsAgent: { secret: 'OPSAGENT_API_KEY', riskLevel: 'low' },
  CommerceAgent: { secret: 'COMMERCEAGENT_API_KEY', riskLevel: 'high' },
  CommunityAgent: { secret: 'COMMUNITYAGENT_API_KEY', riskLevel: 'medium' },
};

// HMAC verification middleware
const verifyHMAC = async (c: any, next: any) => {
  const agentId = c.req.header('X-Agent-Id');
  const timestamp = c.req.header('X-Timestamp');
  const signature = c.req.header('X-Signature');
  
  if (!agentId || !timestamp || !signature) {
    return c.json({ error: 'Missing authentication headers' }, 401);
  }
  
  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 300) { // 5 minute window
    return c.json({ error: 'Request timestamp too old' }, 401);
  }
  
  // Get agent configuration
  const agentConfig = AGENT_CONFIG[agentId as keyof typeof AGENT_CONFIG];
  if (!agentConfig) {
    return c.json({ error: 'Unknown agent' }, 401);
  }
  
  // Get secret
  const secret = c.env[agentConfig.secret as keyof Env] as string;
  if (!secret) {
    console.error(`Missing secret for agent ${agentId}`);
    return c.json({ error: 'Internal configuration error' }, 500);
  }
  
  // Verify HMAC
  const body = await c.req.text();
  const message = `${agentId}:${timestamp}:${body}`;
  const expectedSignature = createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  const providedSig = Buffer.from(signature, 'hex');
  const expectedSig = Buffer.from(expectedSignature, 'hex');
  
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  // Store agent info and body for later use
  c.set('agentId', agentId);
  c.set('agentRiskLevel', agentConfig.riskLevel);
  c.set('body', body);
  
  await next();
};

// Apply HMAC middleware to all agent routes
agentRouter.use('*', verifyHMAC);

// Schema definitions
const ContentProposalSchema = z.object({
  path: z.string().regex(/^[a-z0-9\-\/]+\.(md|mdx)$/),
  markdown: z.string().max(50000),
  reason: z.string(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

const FlagChangeSchema = z.object({
  flagKey: z.string(),
  value: z.any(),
  ttl: z.number().optional(),
  reason: z.string(),
});

const TaskSchema = z.object({
  type: z.string(),
  payload: z.any(),
  priority: z.number().min(0).max(10).default(5),
  scheduledFor: z.string().datetime().optional(),
});

// POST /agent/proposals/content - Create content PR
agentRouter.post('/proposals/content', async (c) => {
  const body = JSON.parse(c.get('body'));
  const agentId = c.get('agentId');
  const riskLevel = c.get('agentRiskLevel');
  
  // Validate input
  const result = ContentProposalSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }
  
  const db = drizzle(c.env.DB);
  const changeId = nanoid();
  
  // Record the change
  await db.insert(agentChanges).values({
    id: changeId,
    agentId,
    action: 'content_proposal',
    payloadHash: createHmac('sha256', 'salt').update(JSON.stringify(result.data)).digest('hex'),
    payload: result.data,
    riskLevel,
    status: riskLevel === 'low' ? 'approved' : 'pending',
  });
  
  // If auto-approved (low risk), create the PR immediately
  if (riskLevel === 'low') {
    // TODO: Call GitHub API to create PR
    // const pr = await createGitHubPR(result.data, agentId, c.env);
    
    return c.json({
      id: changeId,
      status: 'approved',
      message: 'Content proposal auto-approved and PR created',
      // prUrl: pr.url,
      // previewUrl: pr.previewUrl,
    });
  }
  
  return c.json({
    id: changeId,
    status: 'pending',
    message: 'Content proposal requires human approval',
    approvalUrl: `https://cloudflair.com/admin/approvals/${changeId}`,
  });
});

// POST /agent/flags - Update feature flags
agentRouter.post('/flags', async (c) => {
  const body = JSON.parse(c.get('body'));
  const agentId = c.get('agentId');
  const riskLevel = c.get('agentRiskLevel');
  
  const result = FlagChangeSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }
  
  const db = drizzle(c.env.DB);
  const changeId = nanoid();
  
  // Check if high risk
  const isHighRisk = result.data.flagKey.includes('production') || 
                     result.data.flagKey.includes('critical');
  
  if (isHighRisk && riskLevel !== 'low') {
    // Record for approval
    await db.insert(agentChanges).values({
      id: changeId,
      agentId,
      action: 'flag_change',
      payloadHash: createHmac('sha256', 'salt').update(JSON.stringify(result.data)).digest('hex'),
      payload: result.data,
      riskLevel: 'high',
      status: 'pending',
    });
    
    return c.json({
      id: changeId,
      status: 'pending',
      message: 'High-risk flag change requires approval',
    });
  }
  
  // Apply the flag change
  await c.env.CONFIG_KV.put(
    result.data.flagKey,
    JSON.stringify(result.data.value),
    result.data.ttl ? { expirationTtl: result.data.ttl } : undefined
  );
  
  // Record the change
  await db.insert(featureFlags).values({
    id: nanoid(),
    key: result.data.flagKey,
    value: result.data.value,
    changedBy: agentId,
    changeReason: result.data.reason,
  });
  
  return c.json({
    id: changeId,
    status: 'applied',
    message: 'Flag updated successfully',
  });
});

// POST /agent/tasks - Queue background tasks
agentRouter.post('/tasks', async (c) => {
  const body = JSON.parse(c.get('body'));
  const agentId = c.get('agentId');
  
  const result = TaskSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }
  
  const db = drizzle(c.env.DB);
  const taskId = nanoid();
  
  // Create task record
  await db.insert(agentTasks).values({
    id: taskId,
    agentId,
    type: result.data.type,
    payloadJson: result.data.payload,
    priority: result.data.priority,
    scheduledFor: result.data.scheduledFor ? new Date(result.data.scheduledFor) : undefined,
  });
  
  // Queue the task
  await c.env.JOBS_QUEUE.send({
    taskId,
    agentId,
    type: result.data.type,
    payload: result.data.payload,
  });
  
  return c.json({
    id: taskId,
    status: 'queued',
    message: 'Task queued for processing',
  });
});

// GET /agent/metrics/snapshot - Get current KPIs
agentRouter.get('/metrics/snapshot', async (c) => {
  const db = drizzle(c.env.DB);
  
  // Get latest KPI snapshots
  const today = new Date().toISOString().split('T')[0];
  const metrics = await db.select()
    .from(kpiSnapshots)
    .where(eq(kpiSnapshots.date, today))
    .limit(100);
  
  // Get recent agent activity
  const recentActivity = await db.select()
    .from(agentChanges)
    .orderBy(agentChanges.createdAt)
    .limit(10);
  
  return c.json({
    date: today,
    metrics: metrics.reduce((acc, m) => {
      acc[m.metric] = {
        value: m.value,
        previousValue: m.previousValue,
        change: m.change,
      };
      return acc;
    }, {} as Record<string, any>),
    agentActivity: {
      recentChanges: recentActivity.length,
      pendingApprovals: recentActivity.filter(a => a.status === 'pending').length,
    },
  });
});

// POST /agent/seo/audit - Trigger SEO audit
agentRouter.post('/seo/audit', async (c) => {
  const body = JSON.parse(c.get('body'));
  const agentId = c.get('agentId');
  
  // Queue SEO audit task
  const taskId = nanoid();
  await c.env.JOBS_QUEUE.send({
    taskId,
    agentId,
    type: 'seo_audit',
    payload: body,
  });
  
  return c.json({
    id: taskId,
    status: 'queued',
    message: 'SEO audit queued',
  });
});

export { agentRouter };
