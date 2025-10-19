import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { 
  Zap, Shield, Bot, BarChart3, Code2, Users, 
  CheckCircle2, ArrowRight, Sparkles, Globe,
  Lock, Activity
} from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="container relative z-10 mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="outline" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              Powered by Cloudflare Edge
            </Badge>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              The Web Platform That{' '}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Manages Itself
              </span>
            </h1>
            <p className="mb-8 text-xl text-slate-600 dark:text-slate-400">
              CloudFlair delivers a 90% agent-managed web infrastructure. Deploy once, 
              then let AI agents handle content, SEO, monitoring, and optimization while 
              you focus on strategy.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link href="/pricing">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/docs">View Documentation</Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-blue-400 to-cyan-400 opacity-20 blur-3xl" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t bg-white py-24 dark:bg-slate-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">
              Enterprise-Grade Infrastructure, Zero Complexity
            </h2>
            <p className="mb-12 text-lg text-slate-600 dark:text-slate-400">
              Built on Cloudflare's global network with integrated AI automation
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Bot className="mb-2 h-8 w-8 text-orange-500" />
                <CardTitle>5 Specialized AI Agents</CardTitle>
                <CardDescription>
                  Content, SEO, Operations, Commerce, and Community agents working 24/7
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>PR-first content management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Automated SEO optimization</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>1,276+ ready playbooks</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="mb-2 h-8 w-8 text-orange-500" />
                <CardTitle>Cloudflare Edge Network</CardTitle>
                <CardDescription>
                  Deploy globally in seconds with zero-config scaling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>D1 database at the edge</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>R2 storage with no egress fees</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Queue & Cron automation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="mb-2 h-8 w-8 text-orange-500" />
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Bank-grade security with complete audit trails
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>HMAC authentication</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Zero Trust access control</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Risk-based approvals</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="mb-2 h-8 w-8 text-orange-500" />
                <CardTitle>Executive Dashboard</CardTitle>
                <CardDescription>
                  Real-time KPIs and daily executive reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Daily email summaries</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Prometheus metrics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Risk analysis & alerts</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Code2 className="mb-2 h-8 w-8 text-orange-500" />
                <CardTitle>Developer Experience</CardTitle>
                <CardDescription>
                  TypeScript, React, and modern tooling throughout
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Next.js on Pages</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Hono API framework</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>GitHub Actions CI/CD</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="mb-2 h-8 w-8 text-orange-500" />
                <CardTitle>Built-in Commerce</CardTitle>
                <CardDescription>
                  Stripe integration with subscription management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Checkout & billing portal</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Newsletter management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>Event calendar system</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t bg-slate-50 py-16 dark:bg-slate-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 text-center md:grid-cols-4">
            <div>
              <div className="text-4xl font-bold text-orange-500">90%</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Agent-Managed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500">1,276+</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Playbooks Ready</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500">195</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Global Locations</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500">99.99%</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-white py-24 dark:bg-slate-900">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">
            Ready to Automate Your Web Platform?
          </h2>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-400">
            Join companies running on autopilot with CloudFlair
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/pricing">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link href="/contact">Talk to Sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
