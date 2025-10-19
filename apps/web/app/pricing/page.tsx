'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small projects and testing',
    price: {
      monthly: 29,
      yearly: 290,
    },
    features: [
      '2 AI Agents (Content & SEO)',
      '10,000 requests/month',
      '1GB R2 storage',
      'Basic email reports',
      'Community support',
      '99.9% uptime SLA',
    ],
    limitations: [
      'No custom domains',
      'CloudFlair branding',
      'Limited playbooks',
    ],
    cta: 'Start Free Trial',
    priceId: {
      monthly: 'price_starter_monthly',
      yearly: 'price_starter_yearly',
    },
  },
  {
    name: 'Professional',
    description: 'For growing businesses and teams',
    price: {
      monthly: 99,
      yearly: 990,
    },
    popular: true,
    features: [
      'All 5 AI Agents',
      '100,000 requests/month',
      '10GB R2 storage',
      'Daily executive reports',
      'Priority support',
      '99.95% uptime SLA',
      'Custom domains',
      'Advanced analytics',
      'All 1,276 playbooks',
      'GitHub integration',
    ],
    limitations: [],
    cta: 'Start Free Trial',
    priceId: {
      monthly: 'price_pro_monthly',
      yearly: 'price_pro_yearly',
    },
  },
  {
    name: 'Enterprise',
    description: 'Full power for large organizations',
    price: {
      monthly: 'custom',
      yearly: 'custom',
    },
    features: [
      'Unlimited AI Agents',
      'Unlimited requests',
      'Unlimited R2 storage',
      'Real-time reports',
      'Dedicated support',
      '99.99% uptime SLA',
      'Multiple custom domains',
      'Advanced security',
      'Custom playbooks',
      'API access',
      'SSO/SAML',
      'Compliance reports',
      'Custom integrations',
      'Training & onboarding',
    ],
    limitations: [],
    cta: 'Contact Sales',
    priceId: null,
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleCheckout = async (priceId: string | null) => {
    if (!priceId) {
      // Redirect to contact form for enterprise
      window.location.href = '/contact?plan=enterprise';
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: window.location.href,
          mode: billingPeriod === 'yearly' ? 'subscription' : 'subscription',
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  return (
    <>
      <section className="border-b bg-gradient-to-b from-slate-50 to-white py-20 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <Badge variant="outline" className="mb-4">
            <span className="mr-1">🎯</span>
            30-day money-back guarantee
          </Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Choose the perfect plan for your automation needs
          </p>
          
          {/* Billing Toggle */}
          <div className="mb-12 flex items-center justify-center gap-4">
            <span className={cn(
              'text-sm font-medium',
              billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:bg-slate-700"
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
            <span className={cn(
              'text-sm font-medium',
              billingPeriod === 'yearly' ? 'text-foreground' : 'text-muted-foreground'
            )}>
              Yearly
              <Badge variant="default" className="ml-2">
                Save 20%
              </Badge>
            </span>
          </div>

          {/* Pricing Cards */}
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  'relative overflow-hidden',
                  plan.popular && 'border-orange-500 shadow-lg'
                )}
              >
                {plan.popular && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 text-xs font-semibold text-white">
                    MOST POPULAR
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Price */}
                  <div>
                    {plan.price[billingPeriod] === 'custom' ? (
                      <div className="text-3xl font-bold">Custom Pricing</div>
                    ) : (
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold">
                          ${plan.price[billingPeriod]}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          /{billingPeriod === 'yearly' ? 'year' : 'month'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-left">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start text-muted-foreground">
                        <X className="mr-2 h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-left">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleCheckout(
                      plan.priceId 
                        ? plan.priceId[billingPeriod] 
                        : null
                    )}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">Compare Plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">Features</th>
                  <th className="px-4 py-3 text-center">Starter</th>
                  <th className="px-4 py-3 text-center">Professional</th>
                  <th className="px-4 py-3 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'AI Agents', starter: '2', pro: '5', enterprise: 'Unlimited' },
                  { feature: 'Monthly Requests', starter: '10K', pro: '100K', enterprise: 'Unlimited' },
                  { feature: 'Storage', starter: '1GB', pro: '10GB', enterprise: 'Unlimited' },
                  { feature: 'Playbooks', starter: 'Basic', pro: 'All 1,276', enterprise: 'Custom' },
                  { feature: 'Reports', starter: 'Weekly', pro: 'Daily', enterprise: 'Real-time' },
                  { feature: 'Support', starter: 'Community', pro: 'Priority', enterprise: 'Dedicated' },
                  { feature: 'Custom Domain', starter: '❌', pro: '✅', enterprise: '✅' },
                  { feature: 'API Access', starter: '❌', pro: 'Limited', enterprise: 'Full' },
                  { feature: 'SSO/SAML', starter: '❌', pro: '❌', enterprise: '✅' },
                  { feature: 'SLA', starter: '99.9%', pro: '99.95%', enterprise: '99.99%' },
                ].map((row) => (
                  <tr key={row.feature} className="border-b">
                    <td className="px-4 py-3 font-medium">{row.feature}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.starter}</td>
                    <td className="px-4 py-3 text-center">{row.pro}</td>
                    <td className="px-4 py-3 text-center font-medium">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-slate-50 py-20 dark:bg-slate-950">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">Frequently Asked Questions</h2>
          <div className="space-y-8">
            {[
              {
                q: 'Can I change plans anytime?',
                a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and are prorated.',
              },
              {
                q: 'What happens to my data if I cancel?',
                a: 'Your data is retained for 30 days after cancellation. You can export it anytime or reactivate your account.',
              },
              {
                q: 'Do you offer a free trial?',
                a: 'Yes, all plans come with a 14-day free trial. No credit card required to start.',
              },
              {
                q: 'How do the AI agents work?',
                a: 'Our AI agents run autonomously based on your configuration, handling tasks like content creation, SEO optimization, and system monitoring 24/7.',
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-lg border bg-background p-6">
                <h3 className="mb-2 font-semibold">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
