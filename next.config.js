const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify is the default in Next.js 13+ — explicit for clarity
  swcMinify: true,

  // ── Reduce response size ──────────────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,

  experimental: {
    serverComponentsExternalPackages: ['sequelize', 'mysql2', 'bcrypt'],
    // Tree-shake icon libraries — only includes icons actually imported
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'framer-motion'],
    turbo: {
      root: path.resolve(__dirname),
    },
  },

  // ── Image optimization ────────────────────────────────────────────────────────
  images: {
    // Serve AVIF first (50% smaller than WebP), fallback to WebP
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'fonts.gstatic.com' },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 30 days in the CDN/browser
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Prevent excessive image optimization requests
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ── Headers ───────────────────────────────────────────────────────────────────
  async headers() {
    return [
      // ── Long-lived cache for static image assets ──
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ── Cache for other static public assets ──
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ── Security headers for all routes ──────────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          // Clickjacking protection
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIME-type sniffing prevention
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // XSS protection (legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer policy — don't leak URL to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy — disable unused browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          // HSTS — force HTTPS for 1 year (enable in production behind HTTPS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts — self + inline (Next.js requires unsafe-inline for hydration)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
              // Styles — self + inline + Google Fonts (kept for fallback)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts — self-hosted via next/font + Google Fonts CDN as fallback
              "font-src 'self' https://fonts.gstatic.com data:",
              // Images — self + data URIs + common CDNs
              "img-src 'self' data: blob: https:",
              // Connect — self + OpenRouter + Groq AI APIs
              "connect-src 'self' https://openrouter.ai https://api.groq.com https://fonts.googleapis.com",
              // Frame ancestors — deny embedding
              "frame-ancestors 'none'",
              // Media
              "media-src 'self'",
              // Objects — disable plugins
              "object-src 'none'",
              // Base URI restriction
              "base-uri 'self'",
              // Form actions
              "form-action 'self'",
              // Upgrade insecure requests in production
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // ── Webpack ───────────────────────────────────────────────────────────────────
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // Prevent heavy server-side packages from being bundled client-side
      config.externals = [...(config.externals || []), 'sequelize', 'mysql2', 'bcrypt'];
    }

    // In production: enable module concatenation for smaller bundles
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        // Split vendor chunks for better caching
        splitChunks: {
          ...config.optimization?.splitChunks,
          chunks: 'all',
          cacheGroups: {
            // Isolate framer-motion into its own chunk (loaded only with MobileSwipeStrip)
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'all',
              priority: 20,
            },
            // Isolate react-router-dom into its own chunk
            reactRouter: {
              test: /[\\/]node_modules[\\/]react-router[\\/]|[\\/]node_modules[\\/]react-router-dom[\\/]/,
              name: 'react-router',
              chunks: 'all',
              priority: 19,
            },
          },
        },
      };
    }

    return config;
  },
};

module.exports = nextConfig;
