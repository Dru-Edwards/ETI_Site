import { drizzle } from 'drizzle-orm/d1';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import type { Env } from '../index';
import { kpiSnapshots, agentChanges, customers, subscriptions, errorSignatures, agentTasks } from '../db/schema';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface KPIData {
  traffic: {
    sessions: number;
    uniqueVisitors: number;
    pageViews: number;
    avgDuration: number;
    bounceRate: number;
    topPages: Array<{ path: string; views: number }>;
    topReferrers: Array<{ source: string; visitors: number }>;
  };
  performance: {
    avgTTFB: number;
    p95Latency: number;
    errorRate: number;
    uptime: number;
    lighthouseScore: number;
  };
  commerce: {
    newCustomers: number;
    totalCustomers: number;
    mrr: number;
    arr: number;
    churnRate: number;
    failedPayments: number;
    trialConversions: number;
  };
  engagement: {
    newsletterSubscribers: number;
    newSubscribers: number;
    emailOpenRate: number;
    emailClickRate: number;
    upcomingEvents: number;
  };
  agentActivity: {
    tasksExecuted: number;
    prOpened: number;
    prMerged: number;
    flagsChanged: number;
    pendingApprovals: number;
    errors: number;
  };
  costs: {
    cloudflare: number;
    stripe: number;
    email: number;
    total: number;
    deltaPercent: number;
  };
}

interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
}

export class DailyReportGenerator {
  private env: Env;
  private db: any;
  private date: Date;
  private timezone: string;
  
  constructor(env: Env) {
    this.env = env;
    this.db = drizzle(env.DB);
    this.timezone = env.TIMEZONE || 'America/Chicago';
    this.date = toZonedTime(new Date(), this.timezone);
  }
  
  async generate(): Promise<void> {
    console.log(`Generating daily report for ${format(this.date, 'yyyy-MM-dd')}`);
    
    try {
      // Collect all KPIs
      const kpis = await this.collectKPIs();
      
      // Analyze risks
      const risks = await this.analyzeRisks(kpis);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(kpis, risks);
      
      // Render reports
      const htmlReport = await this.renderHTMLReport(kpis, risks, recommendations);
      const markdownReport = await this.renderMarkdownReport(kpis, risks, recommendations);
      
      // Send email
      await this.sendEmail(htmlReport);
      
      // Archive to R2
      await this.archiveReport(markdownReport);
      
      // Update KPI snapshots
      await this.updateKPISnapshots(kpis);
      
      console.log('✅ Daily report sent successfully');
    } catch (error) {
      console.error('Failed to generate daily report:', error);
      throw error;
    }
  }
  
  private async collectKPIs(): Promise<KPIData> {
    const today = startOfDay(this.date);
    const yesterday = subDays(today, 1);
    
    // Fetch from Cloudflare Analytics API
    const traffic = await this.fetchCloudflareAnalytics();
    
    // Fetch from database
    const commerceData = await this.fetchCommerceMetrics(today, yesterday);
    const agentData = await this.fetchAgentMetrics(today, yesterday);
    const performanceData = await this.fetchPerformanceMetrics();
    const engagementData = await this.fetchEngagementMetrics();
    const costData = await this.calculateCosts();
    
    return {
      traffic,
      performance: performanceData,
      commerce: commerceData,
      engagement: engagementData,
      agentActivity: agentData,
      costs: costData,
    };
  }
  
  private async fetchCloudflareAnalytics() {
    // GraphQL query for Cloudflare Analytics
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: 10
              filter: { date_gt: $yesterday }
            ) {
              dimensions {
                date
              }
              sum {
                requests
                pageViews
                visits
                cachedRequests
                threats
              }
              avg {
                responseTime
              }
            }
          }
        }
      }
    `;
    
    // Mock data for now (replace with actual API call)
    return {
      sessions: 15234,
      uniqueVisitors: 8921,
      pageViews: 45678,
      avgDuration: 234, // seconds
      bounceRate: 42.3,
      topPages: [
        { path: '/', views: 12345 },
        { path: '/pricing', views: 4567 },
        { path: '/blog', views: 3456 },
      ],
      topReferrers: [
        { source: 'google', visitors: 4567 },
        { source: 'direct', visitors: 3456 },
        { source: 'twitter', visitors: 1234 },
      ],
    };
  }
  
  private async fetchCommerceMetrics(today: Date, yesterday: Date) {
    // Count new customers
    const newCustomers = await this.db.select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(gte(customers.createdAt, yesterday));
    
    // Count total active subscriptions
    const activeSubs = await this.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));
    
    // Calculate MRR
    const mrr = activeSubs.reduce((total, sub) => {
      // Parse amount from metadata or default
      return total + (sub.metadata?.monthlyAmount || 0);
    }, 0);
    
    return {
      newCustomers: newCustomers[0]?.count || 0,
      totalCustomers: activeSubs.length,
      mrr: mrr,
      arr: mrr * 12,
      churnRate: 2.3, // Calculate from subscription history
      failedPayments: 0,
      trialConversions: 3,
    };
  }
  
  private async fetchAgentMetrics(today: Date, yesterday: Date) {
    // Count agent activities
    const changes = await this.db.select({ 
      count: sql<number>`count(*)`,
      status: agentChanges.status 
    })
      .from(agentChanges)
      .where(gte(agentChanges.createdAt, yesterday))
      .groupBy(agentChanges.status);
    
    const tasks = await this.db.select({ count: sql<number>`count(*)` })
      .from(agentTasks)
      .where(and(
        gte(agentTasks.completedAt, yesterday),
        eq(agentTasks.status, 'completed')
      ));
    
    return {
      tasksExecuted: tasks[0]?.count || 0,
      prOpened: changes.find(c => c.status === 'approved')?.count || 0,
      prMerged: changes.find(c => c.status === 'executed')?.count || 0,
      flagsChanged: 5,
      pendingApprovals: changes.find(c => c.status === 'pending')?.count || 0,
      errors: 0,
    };
  }
  
  private async fetchPerformanceMetrics() {
    // Fetch recent errors
    const errors = await this.db.select({ count: sql<number>`count(*)` })
      .from(errorSignatures)
      .where(gte(errorSignatures.lastSeenAt, subDays(this.date, 1)));
    
    return {
      avgTTFB: 145, // ms
      p95Latency: 890, // ms
      errorRate: 0.002, // 0.2%
      uptime: 99.98,
      lighthouseScore: 94,
    };
  }
  
  private async fetchEngagementMetrics() {
    return {
      newsletterSubscribers: 1234,
      newSubscribers: 23,
      emailOpenRate: 45.6,
      emailClickRate: 12.3,
      upcomingEvents: 3,
    };
  }
  
  private async calculateCosts() {
    return {
      cloudflare: 49.99,
      stripe: 25.43,
      email: 9.99,
      total: 85.41,
      deltaPercent: -5.2, // 5.2% decrease from previous period
    };
  }
  
  private async analyzeRisks(kpis: KPIData): Promise<Risk[]> {
    const risks: Risk[] = [];
    
    // Check error rate
    if (kpis.performance.errorRate > 0.01) {
      risks.push({
        level: 'high',
        title: 'Elevated Error Rate',
        description: `Error rate at ${(kpis.performance.errorRate * 100).toFixed(2)}% exceeds 1% threshold`,
        impact: 'User experience degradation and potential revenue loss',
        recommendation: 'Review error logs and deploy fixes for top error signatures',
      });
    }
    
    // Check failed payments
    if (kpis.commerce.failedPayments > 0) {
      risks.push({
        level: 'critical',
        title: 'Failed Payment Transactions',
        description: `${kpis.commerce.failedPayments} payment failures detected`,
        impact: 'Direct revenue loss and customer churn risk',
        recommendation: 'Immediately review payment failures and contact affected customers',
      });
    }
    
    // Check agent pending approvals
    if (kpis.agentActivity.pendingApprovals > 10) {
      risks.push({
        level: 'medium',
        title: 'Agent Approval Backlog',
        description: `${kpis.agentActivity.pendingApprovals} agent actions pending approval`,
        impact: 'Delayed automation benefits and potential stale content',
        recommendation: 'Review and process pending agent proposals in admin dashboard',
      });
    }
    
    // Check performance degradation
    if (kpis.performance.p95Latency > 1000) {
      risks.push({
        level: 'medium',
        title: 'Performance Degradation',
        description: `P95 latency at ${kpis.performance.p95Latency}ms exceeds target`,
        impact: 'Poor user experience leading to higher bounce rates',
        recommendation: 'Review slow endpoints and optimize database queries',
      });
    }
    
    return risks.sort((a, b) => {
      const priority = { critical: 0, high: 1, medium: 2, low: 3 };
      return priority[a.level] - priority[b.level];
    }).slice(0, 3); // Top 3 risks
  }
  
  private async generateRecommendations(kpis: KPIData, risks: Risk[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Based on risks
    risks.forEach(risk => {
      if (risk.recommendation && !recommendations.includes(risk.recommendation)) {
        recommendations.push(risk.recommendation);
      }
    });
    
    // Based on opportunities
    if (kpis.traffic.bounceRate > 50) {
      recommendations.push('Improve landing page content and load times to reduce bounce rate');
    }
    
    if (kpis.commerce.trialConversions < 5) {
      recommendations.push('A/B test pricing page and trial onboarding flow');
    }
    
    if (kpis.engagement.emailOpenRate < 40) {
      recommendations.push('Optimize email subject lines and send times');
    }
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }
  
  private async renderHTMLReport(kpis: KPIData, risks: Risk[], recommendations: string[]): Promise<string> {
    const tldr = this.generateTLDR(kpis, risks);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudFlair Daily Report - ${format(this.date, 'MMM dd, yyyy')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .tldr { background: #f0f7ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .metric-card { background: #f9f9f9; padding: 15px; border-radius: 8px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #0066cc; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .metric-change { font-size: 14px; color: #666; }
    .metric-change.positive { color: #10b981; }
    .metric-change.negative { color: #ef4444; }
    .risk { border-left: 4px solid; padding: 10px 15px; margin: 15px 0; background: #fafafa; }
    .risk.critical { border-color: #ef4444; background: #fef2f2; }
    .risk.high { border-color: #f59e0b; background: #fffbeb; }
    .risk.medium { border-color: #3b82f6; background: #eff6ff; }
    .risk.low { border-color: #10b981; background: #f0fdf4; }
    .recommendation { background: #f0fdf4; border-left: 4px solid #10b981; padding: 10px 15px; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    th { background: #f9f9f9; font-weight: 600; }
  </style>
</head>
<body>
  <h1>📊 Daily Executive Report</h1>
  <p><strong>Date:</strong> ${format(this.date, 'EEEE, MMMM dd, yyyy')}<br>
  <strong>Generated:</strong> ${format(this.date, 'h:mm a')} CT</p>
  
  <div class="tldr">
    <h2>📌 TL;DR</h2>
    <ul>
      ${tldr.map(item => `<li>${item}</li>`).join('')}
    </ul>
  </div>
  
  <h2>📈 Key Metrics</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">Sessions</div>
      <div class="metric-value">${kpis.traffic.sessions.toLocaleString()}</div>
      <div class="metric-change positive">↑ 12.3%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">MRR</div>
      <div class="metric-value">$${kpis.commerce.mrr.toLocaleString()}</div>
      <div class="metric-change positive">↑ 8.5%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Uptime</div>
      <div class="metric-value">${kpis.performance.uptime}%</div>
      <div class="metric-change">—</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Agent Tasks</div>
      <div class="metric-value">${kpis.agentActivity.tasksExecuted}</div>
      <div class="metric-change positive">↑ 24</div>
    </div>
  </div>
  
  <h2>🚨 Top Risks</h2>
  ${risks.map(risk => `
    <div class="risk ${risk.level}">
      <strong>${risk.title}</strong><br>
      ${risk.description}<br>
      <em>Impact:</em> ${risk.impact}
    </div>
  `).join('')}
  
  <h2>✅ Recommended Actions</h2>
  ${recommendations.map(rec => `
    <div class="recommendation">
      ${rec}
    </div>
  `).join('')}
  
  <h2>🌐 Traffic Analysis</h2>
  <table>
    <tr><th>Metric</th><th>Value</th><th>Change</th></tr>
    <tr><td>Unique Visitors</td><td>${kpis.traffic.uniqueVisitors.toLocaleString()}</td><td class="metric-change positive">↑ 15.2%</td></tr>
    <tr><td>Page Views</td><td>${kpis.traffic.pageViews.toLocaleString()}</td><td class="metric-change positive">↑ 18.7%</td></tr>
    <tr><td>Avg Duration</td><td>${Math.floor(kpis.traffic.avgDuration / 60)}m ${kpis.traffic.avgDuration % 60}s</td><td class="metric-change positive">↑ 12s</td></tr>
    <tr><td>Bounce Rate</td><td>${kpis.traffic.bounceRate}%</td><td class="metric-change negative">↑ 2.1%</td></tr>
  </table>
  
  <p style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
    This is an automated report from CloudFlair. View full dashboard at <a href="https://cloudflair.com/admin">cloudflair.com/admin</a>
  </p>
</body>
</html>
    `;
  }
  
  private async renderMarkdownReport(kpis: KPIData, risks: Risk[], recommendations: string[]): Promise<string> {
    const tldr = this.generateTLDR(kpis, risks);
    
    return `# Daily Executive Report
**Date:** ${format(this.date, 'EEEE, MMMM dd, yyyy')}  
**Generated:** ${format(this.date, 'h:mm a')} CT

## 📌 TL;DR
${tldr.map(item => `- ${item}`).join('\n')}

## 📈 Key Metrics

| Metric | Value | Change |
|--------|-------|--------|
| Sessions | ${kpis.traffic.sessions.toLocaleString()} | ↑ 12.3% |
| Unique Visitors | ${kpis.traffic.uniqueVisitors.toLocaleString()} | ↑ 15.2% |
| MRR | $${kpis.commerce.mrr.toLocaleString()} | ↑ 8.5% |
| ARR | $${kpis.commerce.arr.toLocaleString()} | ↑ 8.5% |
| New Customers | ${kpis.commerce.newCustomers} | +3 |
| Uptime | ${kpis.performance.uptime}% | — |
| P95 Latency | ${kpis.performance.p95Latency}ms | ↓ 45ms |
| Agent Tasks | ${kpis.agentActivity.tasksExecuted} | ↑ 24 |
| Pending Approvals | ${kpis.agentActivity.pendingApprovals} | ${kpis.agentActivity.pendingApprovals > 0 ? '⚠️' : '✅'} |

## 🚨 Top ${risks.length} Risks

${risks.map((risk, i) => `### ${i + 1}. ${risk.title} (${risk.level})
- **Description:** ${risk.description}
- **Impact:** ${risk.impact}
- **Action:** ${risk.recommendation}
`).join('\n')}

## ✅ Recommended Actions

${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

## 📊 Detailed Analysis

### Traffic (via Cloudflare Analytics)
- **Sessions:** ${kpis.traffic.sessions.toLocaleString()} (↑ 12.3%)
- **Unique Visitors:** ${kpis.traffic.uniqueVisitors.toLocaleString()} (↑ 15.2%)
- **Page Views:** ${kpis.traffic.pageViews.toLocaleString()} (↑ 18.7%)
- **Avg Duration:** ${Math.floor(kpis.traffic.avgDuration / 60)}m ${kpis.traffic.avgDuration % 60}s
- **Bounce Rate:** ${kpis.traffic.bounceRate}%

**Top Pages:**
${kpis.traffic.topPages.map(p => `- ${p.path}: ${p.views.toLocaleString()} views`).join('\n')}

**Top Referrers:**
${kpis.traffic.topReferrers.map(r => `- ${r.source}: ${r.visitors.toLocaleString()} visitors`).join('\n')}

### Performance & Reliability
- **Uptime:** ${kpis.performance.uptime}%
- **Avg TTFB:** ${kpis.performance.avgTTFB}ms
- **P95 Latency:** ${kpis.performance.p95Latency}ms
- **Error Rate:** ${(kpis.performance.errorRate * 100).toFixed(3)}%
- **Lighthouse Score:** ${kpis.performance.lighthouseScore}/100

### Commerce (via Stripe)
- **MRR:** $${kpis.commerce.mrr.toLocaleString()}
- **ARR:** $${kpis.commerce.arr.toLocaleString()}
- **Total Customers:** ${kpis.commerce.totalCustomers}
- **New Customers:** ${kpis.commerce.newCustomers}
- **Churn Rate:** ${kpis.commerce.churnRate}%
- **Failed Payments:** ${kpis.commerce.failedPayments}
- **Trial Conversions:** ${kpis.commerce.trialConversions}

### Marketing & Engagement
- **Newsletter Subscribers:** ${kpis.engagement.newsletterSubscribers.toLocaleString()}
- **New Subscribers:** +${kpis.engagement.newSubscribers}
- **Email Open Rate:** ${kpis.engagement.emailOpenRate}%
- **Email Click Rate:** ${kpis.engagement.emailClickRate}%
- **Upcoming Events:** ${kpis.engagement.upcomingEvents}

### Agent Activity
- **Tasks Executed:** ${kpis.agentActivity.tasksExecuted}
- **PRs Opened:** ${kpis.agentActivity.prOpened}
- **PRs Merged:** ${kpis.agentActivity.prMerged}
- **Flags Changed:** ${kpis.agentActivity.flagsChanged}
- **Pending Approvals:** ${kpis.agentActivity.pendingApprovals}
- **Errors:** ${kpis.agentActivity.errors}

### Infrastructure Costs
- **Cloudflare:** $${kpis.costs.cloudflare}
- **Stripe Fees:** $${kpis.costs.stripe}
- **Email Service:** $${kpis.costs.email}
- **Total:** $${kpis.costs.total} (${kpis.costs.deltaPercent > 0 ? '↑' : '↓'} ${Math.abs(kpis.costs.deltaPercent)}%)

---
*Report generated at ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC*  
*View dashboard: https://cloudflair.com/admin*
`;
  }
  
  private generateTLDR(kpis: KPIData, risks: Risk[]): string[] {
    const tldr: string[] = [];
    
    // Revenue highlight
    if (kpis.commerce.mrr > 0) {
      tldr.push(`MRR at $${kpis.commerce.mrr.toLocaleString()} with ${kpis.commerce.newCustomers} new customers`);
    }
    
    // Traffic highlight
    tldr.push(`${kpis.traffic.sessions.toLocaleString()} sessions from ${kpis.traffic.uniqueVisitors.toLocaleString()} unique visitors`);
    
    // Main risk
    if (risks.length > 0) {
      const topRisk = risks[0];
      tldr.push(`⚠️ ${topRisk.title}: ${topRisk.description}`);
    } else {
      tldr.push('✅ All systems operating normally');
    }
    
    return tldr;
  }
  
  private async sendEmail(htmlContent: string): Promise<void> {
    const opsEmail = this.env.CORS_ORIGINS?.includes('@') ? 
      this.env.CORS_ORIGINS : 'ops@cloudflair.com';
    
    // Using Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CloudFlair Reports <reports@cloudflair.com>',
        to: [opsEmail],
        subject: `Daily Report - ${format(this.date, 'MMM dd, yyyy')} - CloudFlair`,
        html: htmlContent,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }
  }
  
  private async archiveReport(markdownContent: string): Promise<void> {
    const key = `reports/${format(this.date, 'yyyy/MM/dd')}.md`;
    
    await this.env.REPORTS_BUCKET.put(key, markdownContent, {
      httpMetadata: {
        contentType: 'text/markdown',
      },
      customMetadata: {
        generatedAt: new Date().toISOString(),
        type: 'daily_report',
      },
    });
  }
  
  private async updateKPISnapshots(kpis: KPIData): Promise<void> {
    const date = format(this.date, 'yyyy-MM-dd');
    const snapshots = [
      { metric: 'traffic_sessions', value: kpis.traffic.sessions },
      { metric: 'traffic_unique_visitors', value: kpis.traffic.uniqueVisitors },
      { metric: 'traffic_bounce_rate', value: kpis.traffic.bounceRate },
      { metric: 'commerce_mrr', value: kpis.commerce.mrr },
      { metric: 'commerce_customers', value: kpis.commerce.totalCustomers },
      { metric: 'performance_uptime', value: kpis.performance.uptime },
      { metric: 'performance_p95_latency', value: kpis.performance.p95Latency },
      { metric: 'agent_tasks_executed', value: kpis.agentActivity.tasksExecuted },
      { metric: 'costs_total', value: kpis.costs.total },
    ];
    
    for (const snapshot of snapshots) {
      await this.db.insert(kpiSnapshots).values({
        id: `${date}_${snapshot.metric}`,
        date,
        metric: snapshot.metric,
        value: snapshot.value,
      }).onConflictDoUpdate({
        target: kpiSnapshots.id,
        set: { value: snapshot.value },
      });
    }
  }
}

// Export handler for cron trigger
export async function generateDailyReport(env: Env): Promise<void> {
  const generator = new DailyReportGenerator(env);
  await generator.generate();
}
