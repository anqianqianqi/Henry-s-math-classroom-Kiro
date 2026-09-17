/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Tell browsers to cache static assets aggressively so they don't re-fetch
  // from Supabase on every page load. This reduces egress on CDN-cached assets.
  async headers() {
    return [
      {
        // Next.js hashed static chunks — immutable, cache 1 year
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Public folder assets (images, fonts, icons, didi pet sprites, etc.)
        source: '/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Top-level static files served from /public (favicon, manifests, etc.)
        source: '/:file((?!_next|api|app).+\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|otf|mp3|ogg|wav))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
