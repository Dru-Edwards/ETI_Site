'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page view
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Send to CloudFlair analytics endpoint
    if (process.env.NEXT_PUBLIC_API_URL) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/metrics/pageview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          timestamp: new Date().toISOString(),
          referrer: document.referrer,
        }),
      }).catch(() => {
        // Silently fail - don't break the app if analytics fails
      });
    }

    // If using Cloudflare Web Analytics, it auto-tracks
    // No additional code needed as it's injected via dashboard
  }, [pathname, searchParams]);

  return null;
}
