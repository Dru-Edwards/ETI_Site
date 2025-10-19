/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge Runtime for Cloudflare Pages
  experimental: {
    runtime: 'edge',
  },
  
  // Optimize for Cloudflare Pages
  output: 'export',
  
  // Image optimization settings
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['cloudflair.com', 'api.cloudflair.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' challenges.cloudflare.com js.stripe.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: blob: https:;
              font-src 'self' data:;
              connect-src 'self' api.cloudflair.com *.stripe.com challenges.cloudflare.com;
              frame-src 'self' challenges.cloudflare.com js.stripe.com;
            `.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/blog',
        destination: '/blog/archive',
        permanent: false,
      },
      {
        source: '/docs',
        destination: '/docs/getting-started',
        permanent: false,
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.cloudflair.com',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudflair.com',
  },
  
  // TypeScript and ESLint
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle MDX files
    config.module.rules.push({
      test: /\.mdx?$/,
      use: [
        {
          loader: '@mdx-js/loader',
          options: {
            providerImportSource: '@mdx-js/react',
          },
        },
      ],
    });
    
    return config;
  },
};

export default nextConfig;
