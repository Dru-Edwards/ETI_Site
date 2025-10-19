import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { agentTasks, kpiSnapshots } from '../db/schema';
import { nanoid } from 'nanoid';

export async function runSEOAudit(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  
  console.log('Running weekly SEO audit...');
  
  // Queue SEO audit task for OpsAgent
  const taskId = nanoid();
  
  await db.insert(agentTasks).values({
    id: taskId,
    agentId: 'SEOAgent',
    type: 'seo_audit',
    payloadJson: {
      fullSite: true,
      includeImages: true,
      checkBrokenLinks: true,
      analyzeMeta: true,
      timestamp: new Date().toISOString(),
    },
    priority: 5,
    status: 'pending',
  });
  
  // Send to queue for processing
  await env.JOBS_QUEUE.send({
    taskId,
    agentId: 'SEOAgent',
    type: 'seo_audit',
    payload: {
      fullSite: true,
      urls: [
        'https://cloudflair.com',
        'https://cloudflair.com/pricing',
        'https://cloudflair.com/blog',
        'https://cloudflair.com/docs',
      ],
    },
  });
  
  // Store audit initiation in KPIs
  await db.insert(kpiSnapshots).values({
    id: nanoid(),
    date: new Date().toISOString().split('T')[0],
    metric: 'seo_audit_initiated',
    value: 1,
    metaJson: {
      taskId,
      type: 'weekly',
      timestamp: new Date().toISOString(),
    },
  });
  
  console.log(`SEO audit queued with task ID: ${taskId}`);
}
