import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Github, Twitter, Linkedin, Mail } from 'lucide-react';

const footerLinks = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'Agents', href: '/agents' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Changelog', href: '/changelog' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Support', href: '/support' },
    { label: 'Status', href: '/status' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Security', href: '/security' },
    { label: 'Cookie Policy', href: '/cookies' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Newsletter Section */}
        <div className="mb-12 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white">
          <div className="mx-auto max-w-4xl text-center">
            <h3 className="mb-2 text-2xl font-bold">Stay Updated</h3>
            <p className="mb-6 text-orange-100">
              Get weekly insights on AI automation and web platform management
            </p>
            <form className="mx-auto flex max-w-md gap-2">
              <Input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-white/20 text-white placeholder:text-orange-100 border-white/30"
                required
              />
              <Button type="submit" variant="secondary">
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-orange-500 to-amber-500">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">CloudFlair</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              The web platform that manages itself with AI agents.
            </p>
            <div className="mt-6 flex space-x-4">
              <Link href="https://github.com/cloudflair" className="text-muted-foreground hover:text-foreground">
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link href="https://twitter.com/cloudflair" className="text-muted-foreground hover:text-foreground">
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link href="https://linkedin.com/company/cloudflair" className="text-muted-foreground hover:text-foreground">
                <Linkedin className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link href="mailto:hello@cloudflair.com" className="text-muted-foreground hover:text-foreground">
                <Mail className="h-5 w-5" />
                <span className="sr-only">Email</span>
              </Link>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} CloudFlair. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Built with</span>
              <Link href="https://cloudflare.com" className="hover:text-foreground">
                Cloudflare
              </Link>
              <span>•</span>
              <Link href="https://nextjs.org" className="hover:text-foreground">
                Next.js
              </Link>
              <span>•</span>
              <Link href="/agents" className="hover:text-foreground">
                AI Agents
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
