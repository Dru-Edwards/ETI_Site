import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { kpiSnapshots, errorSignatures } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

interface UptimeCheck {
  url: string;
  status: number;
  responseTime: number;
  healthy: boolean;
  error?: string;
}

export async function checkUptime(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const timestamp = new Date();
  const date = timestamp.toISOString().split('T')[0];
  
  console.log('Running uptime checks...');
  
  // Define endpoints to check
  const endpoints = [
    { name: 'web_home', url: 'https://cloudflair.com' },
    { name: 'web_pricing', url: 'https://cloudflair.com/pricing' },
    { name: 'api_health', url: 'https://api.cloudflair.com/health' },
    { name: 'api_metrics', url: 'https://api.cloudflair.com/metrics' },
  ];
  
  const results: UptimeCheck[] = [];
  let totalHealthy = 0;
  
  // Check each endpoint
  for (const endpoint of endpoints) {
    const startTime = Date.now();
    let result: UptimeCheck = {
      url: endpoint.url,
      status: 0,
      responseTime: 0,
      healthy: false,
    };
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      result.status = response.status;
      result.responseTime = Date.now() - startTime;
      result.healthy = response.status >= 200 && response.status < 300;
      
      if (result.healthy) {
        totalHealthy++;
      }
      
      // Store metric
      await db.insert(kpiSnapshots).values({
        id: `${date}_uptime_${endpoint.name}_${timestamp.getTime()}`,
        date,
        metric: `uptime_${endpoint.name}`,
        value: result.healthy ? 1 : 0,
        metaJson: {
          url: endpoint.url,
          status: result.status,
          responseTime: result.responseTime,
          timestamp: timestamp.toISOString(),
        },
      });
      
      // Store response time
      await db.insert(kpiSnapshots).values({
        id: `${date}_response_time_${endpoint.name}_${timestamp.getTime()}`,
        date,
        metric: `response_time_${endpoint.name}`,
        value: result.responseTime,
        metaJson: {
          url: endpoint.url,
          timestamp: timestamp.toISOString(),
        },
      });
      
    } catch (error: any) {
      result.error = error.message;
      
      // Log error
      const errorKey = `uptime_${endpoint.name}_${error.name || 'Error'}`;
      const existing = await db.select()
        .from(errorSignatures)
        .where(eq(errorSignatures.key, errorKey))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(errorSignatures)
          .set({
            count: existing[0].count + 1,
            lastSeenAt: timestamp,
            message: error.message,
          })
          .where(eq(errorSignatures.key, errorKey));
      } else {
        await db.insert(errorSignatures).values({
          id: nanoid(),
          key: errorKey,
          message: error.message,
          stack: error.stack,
          count: 1,
          firstSeenAt: timestamp,
          lastSeenAt: timestamp,
          metadata: {
            endpoint: endpoint.name,
            url: endpoint.url,
          },
        });
      }
    }
    
    results.push(result);
  }
  
  // Calculate overall uptime percentage
  const uptimePercentage = (totalHealthy / endpoints.length) * 100;
  
  // Store overall uptime
  await db.insert(kpiSnapshots).values({
    id: `${date}_overall_uptime_${timestamp.getTime()}`,
    date,
    metric: 'overall_uptime',
    value: uptimePercentage,
    metaJson: {
      total_endpoints: endpoints.length,
      healthy_endpoints: totalHealthy,
      failed_endpoints: endpoints.length - totalHealthy,
      timestamp: timestamp.toISOString(),
      details: results,
    },
  });
  
  console.log(`Uptime check complete: ${uptimePercentage.toFixed(2)}% (${totalHealthy}/${endpoints.length} healthy)`);
  
  // Alert if uptime is below threshold
  if (uptimePercentage < 95) {
    console.error(`⚠️ ALERT: Uptime below 95% threshold - ${uptimePercentage.toFixed(2)}%`);
    
    // Queue alert email
    await env.JOBS_QUEUE.send({
      taskId: nanoid(),
      agentId: 'OpsAgent',
      type: 'send_email',
      payload: {
        to: 'ops@cloudflair.com',
        subject: `⚠️ CloudFlair Uptime Alert - ${uptimePercentage.toFixed(2)}%`,
        html: `
          <h2>Uptime Alert</h2>
          <p>Overall uptime has fallen below 95%: <strong>${uptimePercentage.toFixed(2)}%</strong></p>
          <h3>Failed Endpoints:</h3>
          <ul>
            ${results.filter(r => !r.healthy).map(r => `
              <li>${r.url} - Status: ${r.status || 'Failed'} ${r.error ? `- Error: ${r.error}` : ''}</li>
            `).join('')}
          </ul>
          <p>Time: ${timestamp.toISOString()}</p>
        `,
        text: `Uptime Alert: ${uptimePercentage.toFixed(2)}%\nFailed endpoints: ${results.filter(r => !r.healthy).map(r => r.url).join(', ')}`,
      },
    });
  }
}
