'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  NavigationMenu, 
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu';
import { ModeToggle } from '@/components/mode-toggle';
import { cn } from '@/lib/utils';
import { Zap, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navigationItems = [
  {
    title: 'Product',
    href: '/product',
    children: [
      { title: 'Features', href: '/features', description: 'See what CloudFlair can do' },
      { title: 'Agents', href: '/agents', description: 'Meet our AI workforce' },
      { title: 'Integrations', href: '/integrations', description: 'Connect your tools' },
      { title: 'Security', href: '/security', description: 'Enterprise-grade protection' },
    ],
  },
  { title: 'Pricing', href: '/pricing' },
  { title: 'Docs', href: '/docs' },
  { title: 'Blog', href: '/blog' },
  { title: 'About', href: '/about' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-orange-500 to-amber-500">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">CloudFlair</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="mx-6 hidden md:flex">
          <NavigationMenu>
            <NavigationMenuList>
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.href}>
                  {item.children ? (
                    <>
                      <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <NavigationMenuLink asChild>
                                <Link
                                  href={child.href}
                                  className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                >
                                  <div className="text-sm font-medium leading-none">{child.title}</div>
                                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                    {child.description}
                                  </p>
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <Link href={item.href} legacyBehavior passHref>
                      <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                        {item.title}
                      </NavigationMenuLink>
                    </Link>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        {/* Right side actions */}
        <div className="ml-auto flex items-center space-x-4">
          <ModeToggle />
          
          {/* Desktop buttons */}
          <div className="hidden md:flex md:space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t bg-background md:hidden">
          <nav className="container mx-auto space-y-1 px-4 py-4 sm:px-6">
            {navigationItems.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'block rounded-md px-3 py-2 text-base font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.title}
                </Link>
                {item.children && (
                  <div className="ml-4 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {child.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 space-y-2 border-t pt-4">
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button className="w-full" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
