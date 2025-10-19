import type { Env } from '../index';
import { generateDailyReport } from './dailyReport';
import { runSEOAudit } from './seoAudit';
import { captureAnalyticsSnapshot } from './analyticsSnapshot';
import { checkUptime } from './uptime';
import { nanoid } from 'nanoid';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, lte, sql } from 'drizzle-orm';
import { agentTasks, errorSignatures } from '../db/schema';

export async function handleCronTrigger(event: ScheduledEvent, env: Env): Promise<void> {
  const cronTime = new Date(event.scheduledTime);
  const hour = cronTime.getUTCHours();
  const minute = cronTime.getUTCMinutes();
  const dayOfWeek = cronTime.getUTCDay();
  
  console.log(`Cron triggered at ${cronTime.toISOString()}`);
  
  try {
    // Daily report at 11:30 UTC (6:30 AM CT)
    if (hour === 11 && minute === 30) {
      console.log('Running daily report...');
      await generateDailyReport(env);
    }
    
    // Analytics snapshot every 6 hours
    if (hour % 6 === 0 && minute === 0) {
      console.log('Capturing analytics snapshot...');
      await captureAnalyticsSnapshot(env);
    }
    
    // Weekly SEO audit (Sunday at 2 AM UTC)
    if (dayOfWeek === 0 && hour === 2 && minute === 0) {
      console.log('Running weekly SEO audit...');
      await runSEOAudit(env);
    }
    
    // Uptime check every hour
    if (minute === 0) {
      console.log('Running uptime check...');
      await checkUptime(env);
    }
    
    // Process scheduled agent tasks
    await processScheduledTasks(env);
    
  } catch (error) {
    console.error('Cron job failed:', error);
    // Log to error tracking
    await logCronError(env, error as Error, cronTime);
  }
}

async function processScheduledTasks(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const now = new Date();
  
  // Find tasks scheduled for now or past
  const scheduledTasks = await db.select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.status, 'pending'),
        lte(agentTasks.scheduledFor, now)
      )
    )
    .limit(10);
  
  for (const task of scheduledTasks) {
    // Queue the task for processing
    await env.JOBS_QUEUE.send({
      taskId: task.id,
      agentId: task.agentId,
      type: task.type,
      payload: task.payloadJson,
    });
    
    // Update task status
    await db.update(agentTasks)
      .set({ 
        status: 'running',
        startedAt: now,
      })
      .where(eq(agentTasks.id, task.id));
  }
  
  if (scheduledTasks.length > 0) {
    console.log(`Queued ${scheduledTasks.length} scheduled tasks`);
  }
}

async function logCronError(env: Env, error: Error, cronTime: Date): Promise<void> {
  const db = drizzle(env.DB);
  const errorKey = `cron_${error.name}_${cronTime.getUTCHours()}`;
  
  // Check if this error signature exists
  const existing = await db.select()
    .from(errorSignatures)
    .where(eq(errorSignatures.key, errorKey))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing error signature
    await db.update(errorSignatures)
      .set({
        count: sql`${errorSignatures.count} + 1`,
        lastSeenAt: new Date(),
        stack: error.stack,
      })
      .where(eq(errorSignatures.key, errorKey));
  } else {
    // Create new error signature
    await db.insert(errorSignatures).values({
      id: nanoid(),
      key: errorKey,
      message: error.message,
      stack: error.stack,
      count: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });
  }
}
