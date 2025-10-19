import { Hono } from 'hono';
import Stripe from 'stripe';
import type { Env } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { customers, subscriptions, orders } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const stripeRouter = new Hono<{ Bindings: Env }>();

// Stripe webhook handler
stripeRouter.post('/webhook', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
  
  const sig = c.req.header('stripe-signature');
  if (!sig) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }
  
  const body = await c.req.text();
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return c.json({ error: 'Invalid signature' }, 400);
  }
  
  const db = drizzle(c.env.DB);
  
  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
        
        // Create or update customer
        if (session.customer && session.customer_email) {
          const customerId = nanoid();
          await db.insert(customers)
            .values({
              id: customerId,
              stripeCustomerId: session.customer as string,
              email: session.customer_email,
              name: session.customer_details?.name || null,
              metadata: {
                sessionId: session.id,
                mode: session.mode,
              },
            })
            .onConflictDoUpdate({
              target: customers.stripeCustomerId,
              set: {
                email: session.customer_email,
                name: session.customer_details?.name || null,
              },
            });
          
          // Create order for one-time payment
          if (session.mode === 'payment') {
            await db.insert(orders).values({
              id: nanoid(),
              customerId: customerId,
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string,
              amountCents: session.amount_total || 0,
              currency: session.currency || 'usd',
              status: 'succeeded',
              metadata: {
                lineItems: session.line_items,
              },
            });
          }
        }
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription ${event.type}:`, subscription.id);
        
        // Find customer
        const customer = await db.select()
          .from(customers)
          .where(eq(customers.stripeCustomerId, subscription.customer as string))
          .limit(1);
        
        if (customer.length > 0) {
          const subData = {
            id: nanoid(),
            customerId: customer[0].id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price.id || '',
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            metadata: {
              monthlyAmount: subscription.items.data[0]?.price.unit_amount || 0,
              interval: subscription.items.data[0]?.price.recurring?.interval,
            },
          };
          
          if (event.type === 'customer.subscription.created') {
            await db.insert(subscriptions).values(subData);
          } else {
            await db.update(subscriptions)
              .set(subData)
              .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
          }
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);
        
        await db.update(subscriptions)
          .set({
            status: 'canceled',
            canceledAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.error('Payment failed for invoice:', invoice.id);
        
        // Update subscription status
        if (invoice.subscription) {
          await db.update(subscriptions)
            .set({ status: 'past_due' })
            .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
        }
        
        // TODO: Send email notification to customer
        // await sendPaymentFailedEmail(invoice);
        
        break;
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Update order status
        await db.update(orders)
          .set({ status: 'succeeded' })
          .where(eq(orders.stripePaymentIntentId, paymentIntent.id));
        break;
      }
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    return c.json({ received: true }, 200);
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Return 200 to acknowledge receipt even if processing failed
    // This prevents Stripe from retrying
    return c.json({ received: true, error: 'Processing failed' }, 200);
  }
});

// Create checkout session
stripeRouter.post('/create-checkout-session', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
  
  const body = await c.req.json<{
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    mode?: 'payment' | 'subscription';
  }>();
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      mode: body.mode || 'subscription',
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      customer_email: body.customerEmail,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });
    
    return c.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Failed to create checkout session:', error);
    return c.json({ error: error.message }, 400);
  }
});

// Get customer portal URL
stripeRouter.post('/create-portal-session', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
  
  const body = await c.req.json<{
    customerId: string;
    returnUrl: string;
  }>();
  
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: body.customerId,
      return_url: body.returnUrl,
    });
    
    return c.json({ url: session.url });
  } catch (error: any) {
    console.error('Failed to create portal session:', error);
    return c.json({ error: error.message }, 400);
  }
});

export { stripeRouter };
