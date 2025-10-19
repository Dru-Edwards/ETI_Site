import { Hono } from 'hono';
import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { newsletters, agentTasks } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const newsletterRouter = new Hono<{ Bindings: Env }>();

// Subscribe schema
const SubscribeSchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().optional(),
  metadata: z.object({
    source: z.string().optional(),
    referrer: z.string().optional(),
  }).optional(),
});

// POST /newsletter/subscribe
newsletterRouter.post('/subscribe', async (c) => {
  const body = await c.req.json();
  
  // Validate input
  const result = SubscribeSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }
  
  // Verify Turnstile token if provided
  if (result.data.turnstileToken) {
    const turnstileVerified = await verifyTurnstile(
      result.data.turnstileToken,
      c.env.TURNSTILE_SECRET_KEY || ''
    );
    
    if (!turnstileVerified) {
      return c.json({ error: 'Invalid captcha token' }, 400);
    }
  }
  
  const db = drizzle(c.env.DB);
  
  // Check if already subscribed
  const existing = await db.select()
    .from(newsletters)
    .where(
      and(
        eq(newsletters.email, result.data.email),
        eq(newsletters.provider, 'buttondown')
      )
    )
    .limit(1);
  
  if (existing.length > 0 && existing[0].status === 'confirmed') {
    return c.json({ message: 'Already subscribed' }, 200);
  }
  
  // Create or update subscription record
  const subscriberId = existing.length > 0 ? existing[0].id : nanoid();
  
  if (existing.length > 0) {
    // Resubscribe
    await db.update(newsletters)
      .set({
        status: 'pending',
        subscribedAt: new Date(),
        metadata: result.data.metadata,
      })
      .where(eq(newsletters.id, subscriberId));
  } else {
    // New subscription
    await db.insert(newsletters).values({
      id: subscriberId,
      provider: 'buttondown',
      email: result.data.email,
      status: 'pending',
      metadata: result.data.metadata,
    });
  }
  
  // Queue subscription task
  const taskId = nanoid();
  await db.insert(agentTasks).values({
    id: taskId,
    agentId: 'CommunityAgent',
    type: 'sync_newsletter',
    payloadJson: {
      action: 'subscribe',
      email: result.data.email,
      metadata: result.data.metadata,
    },
    priority: 5,
  });
  
  await c.env.JOBS_QUEUE.send({
    taskId,
    agentId: 'CommunityAgent',
    type: 'sync_newsletter',
    payload: {
      action: 'subscribe',
      email: result.data.email,
    },
  });
  
  return c.json({
    message: 'Subscription request received. Please check your email to confirm.',
    id: subscriberId,
  });
});

// POST /newsletter/unsubscribe
newsletterRouter.post('/unsubscribe', async (c) => {
  const body = await c.req.json<{ email: string; token?: string }>();
  
  if (!body.email) {
    return c.json({ error: 'Email required' }, 400);
  }
  
  const db = drizzle(c.env.DB);
  
  // Find subscription
  const subscription = await db.select()
    .from(newsletters)
    .where(
      and(
        eq(newsletters.email, body.email),
        eq(newsletters.provider, 'buttondown')
      )
    )
    .limit(1);
  
  if (subscription.length === 0) {
    return c.json({ error: 'Subscription not found' }, 404);
  }
  
  // Update status
  await db.update(newsletters)
    .set({
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
    })
    .where(eq(newsletters.id, subscription[0].id));
  
  // Queue unsubscribe task
  const taskId = nanoid();
  await c.env.JOBS_QUEUE.send({
    taskId,
    agentId: 'CommunityAgent',
    type: 'sync_newsletter',
    payload: {
      action: 'unsubscribe',
      email: body.email,
      subscriberId: subscription[0].metadata?.buttondownId,
    },
  });
  
  return c.json({ message: 'Successfully unsubscribed' });
});

// GET /newsletter/archive
newsletterRouter.get('/archive', async (c) => {
  // Fetch from Buttondown API or cache
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  
  try {
    const response = await fetch(
      `https://api.buttondown.email/v1/emails?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Token ${c.env.BUTTONDOWN_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch newsletter archive');
    }
    
    const data = await response.json();
    
    // Transform for frontend
    const newsletters = data.results.map((email: any) => ({
      id: email.id,
      subject: email.subject,
      preview: email.description,
      publishedAt: email.publish_date,
      readingTime: Math.ceil(email.body.split(' ').length / 200),
      url: `/newsletter/${email.slug || email.id}`,
    }));
    
    return c.json({
      newsletters,
      pagination: {
        page,
        limit,
        total: data.count,
        hasMore: data.next !== null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch newsletter archive:', error);
    
    // Return cached or empty
    return c.json({
      newsletters: [],
      pagination: {
        page,
        limit,
        total: 0,
        hasMore: false,
      },
    });
  }
});

// GET /newsletter/:id
newsletterRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    // Fetch from Buttondown API
    const response = await fetch(
      `https://api.buttondown.email/v1/emails/${id}`,
      {
        headers: {
          'Authorization': `Token ${c.env.BUTTONDOWN_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      return c.json({ error: 'Newsletter not found' }, 404);
    }
    
    const email = await response.json();
    
    return c.json({
      id: email.id,
      subject: email.subject,
      body: email.body,
      publishedAt: email.publish_date,
      readingTime: Math.ceil(email.body.split(' ').length / 200),
      metadata: {
        opens: email.open_count,
        clicks: email.click_count,
        subscriberCount: email.subscriber_count,
      },
    });
  } catch (error) {
    console.error('Failed to fetch newsletter:', error);
    return c.json({ error: 'Failed to fetch newsletter' }, 500);
  }
});

// Webhook handler for provider events
newsletterRouter.post('/webhook', async (c) => {
  const body = await c.req.json();
  const signature = c.req.header('x-buttondown-signature');
  
  // Verify webhook signature (implementation depends on provider)
  // For Buttondown, verify HMAC signature
  
  const db = drizzle(c.env.DB);
  
  // Handle webhook events
  switch (body.type) {
    case 'subscriber.created':
    case 'subscriber.confirmed':
      await db.update(newsletters)
        .set({
          status: 'confirmed',
          subscribedAt: new Date(body.data.created_at),
          metadata: {
            ...body.data,
            buttondownId: body.data.id,
          },
        })
        .where(eq(newsletters.email, body.data.email));
      break;
      
    case 'subscriber.unsubscribed':
      await db.update(newsletters)
        .set({
          status: 'unsubscribed',
          unsubscribedAt: new Date(),
        })
        .where(eq(newsletters.email, body.data.email));
      break;
      
    default:
      console.log(`Unhandled newsletter webhook event: ${body.type}`);
  }
  
  return c.json({ received: true });
});

// Helper function to verify Turnstile
async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  if (!secret) return true; // Skip in development
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}

export { newsletterRouter };
