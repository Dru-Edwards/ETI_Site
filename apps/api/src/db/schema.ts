import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['admin', 'user', 'agent'] }).notNull().default('user'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));

// Customers (Stripe)
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  stripeIdx: index('customers_stripe_idx').on(table.stripeCustomerId),
  emailIdx: index('customers_email_idx').on(table.email),
}));

// Subscriptions
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status').notNull(), // active, trialing, past_due, canceled, etc.
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  cancelAt: integer('cancel_at', { mode: 'timestamp' }),
  canceledAt: integer('canceled_at', { mode: 'timestamp' }),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  customerIdx: index('subscriptions_customer_idx').on(table.customerId),
  stripeIdx: index('subscriptions_stripe_idx').on(table.stripeSubscriptionId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
}));

// Orders (one-time purchases)
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
  stripeCheckoutSessionId: text('stripe_checkout_session_id').unique(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('usd'),
  status: text('status').notNull(), // pending, processing, succeeded, failed
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  customerIdx: index('orders_customer_idx').on(table.customerId),
  statusIdx: index('orders_status_idx').on(table.status),
  createdAtIdx: index('orders_created_idx').on(table.createdAt),
}));

// Newsletter subscribers
export const newsletters = sqliteTable('newsletters', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['buttondown', 'beehiiv', 'mailchimp'] }).notNull().default('buttondown'),
  email: text('email').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'unsubscribed'] }).notNull().default('pending'),
  subscribedAt: integer('subscribed_at', { mode: 'timestamp' }),
  unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp' }),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  emailProviderIdx: index('newsletters_email_provider_idx').on(table.email, table.provider),
  statusIdx: index('newsletters_status_idx').on(table.status),
}));

// Events
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  location: text('location'),
  url: text('url'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  startsAtIdx: index('events_starts_idx').on(table.startsAt),
}));

// Agent changes/audit log
export const agentChanges = sqliteTable('agent_changes', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  action: text('action').notNull(), // content_proposal, flag_change, task_execute, etc.
  payloadHash: text('payload_hash').notNull(),
  payload: text('payload', { mode: 'json' }),
  riskLevel: text('risk_level', { enum: ['low', 'medium', 'high'] }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'executed'] }).notNull().default('pending'),
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  executedAt: integer('executed_at', { mode: 'timestamp' }),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  agentIdx: index('agent_changes_agent_idx').on(table.agentId),
  statusIdx: index('agent_changes_status_idx').on(table.status),
  createdIdx: index('agent_changes_created_idx').on(table.createdAt),
}));

// Agent tasks
export const agentTasks = sqliteTable('agent_tasks', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  type: text('type').notNull(), // seo_audit, content_update, analytics_snapshot, etc.
  payloadJson: text('payload_json', { mode: 'json' }),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
  priority: integer('priority').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  result: text('result', { mode: 'json' }),
  error: text('error'),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp' }),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  agentIdx: index('agent_tasks_agent_idx').on(table.agentId),
  statusIdx: index('agent_tasks_status_idx').on(table.status),
  scheduledIdx: index('agent_tasks_scheduled_idx').on(table.scheduledFor),
}));

// KPI snapshots
export const kpiSnapshots = sqliteTable('kpi_snapshots', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD
  metric: text('metric').notNull(), // traffic_sessions, conversion_rate, mrr, etc.
  value: real('value').notNull(),
  previousValue: real('previous_value'),
  change: real('change'), // percentage change
  dimension: text('dimension'), // optional dimension like 'source=google'
  metaJson: text('meta_json', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  dateMetricIdx: index('kpi_date_metric_idx').on(table.date, table.metric),
  metricIdx: index('kpi_metric_idx').on(table.metric),
}));

// Error signatures (for tracking recurring errors)
export const errorSignatures = sqliteTable('error_signatures', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(), // hash or unique identifier
  message: text('message'),
  stack: text('stack'),
  count: integer('count').notNull().default(1),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
  keyIdx: index('errors_key_idx').on(table.key),
  lastSeenIdx: index('errors_last_seen_idx').on(table.lastSeenAt),
}));

// Content (MDX content managed by agents)
export const content = sqliteTable('content', {
  id: text('id').primaryKey(),
  path: text('path').notNull().unique(), // e.g., 'blog/2025-01-15-new-feature.mdx'
  type: text('type', { enum: ['blog', 'docs', 'changelog', 'newsletter'] }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content').notNull(), // MDX content
  frontmatter: text('frontmatter', { mode: 'json' }),
  authorId: text('author_id'), // can be agent ID or user ID
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pathIdx: index('content_path_idx').on(table.path),
  typeIdx: index('content_type_idx').on(table.type),
  statusIdx: index('content_status_idx').on(table.status),
  publishedIdx: index('content_published_idx').on(table.publishedAt),
}));

// Feature flags (managed via KV but tracked in D1 for audit)
export const featureFlags = sqliteTable('feature_flags', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  value: text('value', { mode: 'json' }).notNull(),
  description: text('description'),
  changedBy: text('changed_by').notNull(), // agent ID or user ID
  changeReason: text('change_reason'),
  previousValue: text('previous_value', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  keyIdx: index('flags_key_idx').on(table.key),
  createdIdx: index('flags_created_idx').on(table.createdAt),
}));

// Export all tables
export const schema = {
  users,
  customers,
  subscriptions,
  orders,
  newsletters,
  events,
  agentChanges,
  agentTasks,
  kpiSnapshots,
  errorSignatures,
  content,
  featureFlags,
};
