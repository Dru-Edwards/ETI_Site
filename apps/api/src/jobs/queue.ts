import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { agentTasks, kpiSnapshots } from '../db/schema';
import { nanoid } from 'nanoid';

export interface QueueMessage {
  taskId: string;
  agentId: string;
  type: string;
  payload: any;
}

export async function handleQueueBatch(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  const db = drizzle(env.DB);
  
  for (const message of batch.messages) {
    try {
      await processMessage(message.body, env, db);
      
      // Mark message as successfully processed
      message.ack();
    } catch (error) {
      console.error(`Failed to process message ${message.id}:`, error);
      
      // Update task status to failed
      if (message.body.taskId) {
        await db.update(agentTasks)
          .set({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          })
          .where(eq(agentTasks.id, message.body.taskId));
      }
      
      // Retry the message
      message.retry();
    }
  }
}

async function processMessage(message: QueueMessage, env: Env, db: any): Promise<void> {
  console.log(`Processing task ${message.taskId} of type ${message.type}`);
  
  // Update task status to running
  await db.update(agentTasks)
    .set({
      status: 'running',
      startedAt: new Date(),
    })
    .where(eq(agentTasks.id, message.taskId));
  
  // Process based on task type
  switch (message.type) {
    case 'seo_audit':
      await runSEOAuditTask(message, env, db);
      break;
      
    case 'content_generation':
      await runContentGenerationTask(message, env, db);
      break;
      
    case 'analytics_snapshot':
      await captureAnalyticsSnapshotTask(message, env, db);
      break;
      
    case 'send_email':
      await sendEmailTask(message, env, db);
      break;
      
    case 'sync_newsletter':
      await syncNewsletterTask(message, env, db);
      break;
      
    case 'playbook_execution':
      await executePlaybookTask(message, env, db);
      break;
      
    default:
      console.warn(`Unknown task type: ${message.type}`);
  }
  
  // Update task status to completed
  await db.update(agentTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(agentTasks.id, message.taskId));
}

async function runSEOAuditTask(message: QueueMessage, env: Env, db: any): Promise<void> {
  const { urls, fullSite } = message.payload;
  
  // Run Lighthouse audits
  const audits = [];
  const targetUrls = fullSite ? 
    ['/', '/pricing', '/blog', '/docs'] : 
    urls || ['/'];
  
  for (const url of targetUrls) {
    // In production, this would call Lighthouse CI API
    const audit = {
      url,
      performance: Math.floor(Math.random() * 20) + 80,
      accessibility: Math.floor(Math.random() * 10) + 90,
      bestPractices: Math.floor(Math.random() * 10) + 90,
      seo: Math.floor(Math.random() * 15) + 85,
      timestamp: new Date().toISOString(),
    };
    audits.push(audit);
    
    // Store metrics
    await db.insert(kpiSnapshots).values({
      id: nanoid(),
      date: new Date().toISOString().split('T')[0],
      metric: `lighthouse_${url.replace('/', 'home')}_score`,
      value: audit.performance,
      metaJson: audit,
    });
  }
  
  // Store result in task
  await db.update(agentTasks)
    .set({
      result: { audits },
    })
    .where(eq(agentTasks.id, message.taskId));
}

async function runContentGenerationTask(message: QueueMessage, env: Env, db: any): Promise<void> {
  const { topic, type, keywords } = message.payload;
  
  // This would integrate with your Agent Template Package
  // For now, create placeholder content
  const content = {
    title: `Generated Content: ${topic}`,
    type,
    keywords,
    markdown: `# ${topic}\n\nThis content was generated automatically.\n\nKeywords: ${keywords?.join(', ')}`,
    metadata: {
      generatedAt: new Date().toISOString(),
      agentId: message.agentId,
    },
  };
  
  // Store result
  await db.update(agentTasks)
    .set({
      result: content,
    })
    .where(eq(agentTasks.id, message.taskId));
}

async function captureAnalyticsSnapshotTask(message: QueueMessage, env: Env, db: any): Promise<void> {
  const { metrics } = message.payload;
  const date = new Date().toISOString().split('T')[0];
  
  // Capture specified metrics
  for (const metric of metrics || ['traffic', 'conversions', 'revenue']) {
    const value = Math.floor(Math.random() * 1000); // Mock data
    
    await db.insert(kpiSnapshots).values({
      id: `${date}_${metric}_${Date.now()}`,
      date,
      metric,
      value,
      metaJson: {
        source: 'analytics_snapshot',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

async function sendEmailTask(message: QueueMessage, env: Env, db: any): Promise<void> {
  const { to, subject, html, text } = message.payload;
  
  // Send via Resend API
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'CloudFlair <noreply@cloudflair.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Email send failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // Store result
  await db.update(agentTasks)
    .set({
      result: { emailId: result.id, sentAt: new Date().toISOString() },
    })
    .where(eq(agentTasks.id, message.taskId));
}

async function syncNewsletterTask(message: QueueMessage, env: Env, db: any): Promise<void> {
  const { action, email, subscriberId } = message.payload;
  
  // Sync with Buttondown API
  const baseUrl = 'https://api.buttondown.email/v1';
  
  if (action === 'subscribe') {
    const response = await fetch(`${baseUrl}/subscribers`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      throw new Error(`Newsletter subscription failed: ${response.statusText}`);
    }
  } else if (action === 'unsubscribe' && subscriberId) {
    const response = await fetch(`${baseUrl}/subscribers/${subscriberId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${env.BUTTONDOWN_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Newsletter unsubscribe failed: ${response.statusText}`);
    }
  }
}

async function executePlaybookTask(message: QueueMessage, env: Env, db: any): Promise<void> {
  const { playbookId, context } = message.payload;
  
  // This would integrate with the Agent Template Package's playbook engine
  // For now, log the execution
  console.log(`Executing playbook ${playbookId} with context:`, context);
  
  // Mock execution result
  const result = {
    playbookId,
    executedAt: new Date().toISOString(),
    status: 'success',
    actions: [
      { action: 'analyze', status: 'completed' },
      { action: 'process', status: 'completed' },
      { action: 'report', status: 'completed' },
    ],
  };
  
  // Store result
  await db.update(agentTasks)
    .set({
      result,
    })
    .where(eq(agentTasks.id, message.taskId));
}
