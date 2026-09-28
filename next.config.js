/** @type {import('next').NextConfig} */

/**
 * Students in mainland China cannot reach *.supabase.co — the request dies
 * before it gets a response and the browser reports a bare "Failed to fetch".
 * The page itself loads fine, because it comes from our own domain, so the
 * symptom reads as "the login button does nothing".
 *
 * The fix is to let the browser talk only to a host it can already reach.
 * NEXT_PUBLIC_SUPABASE_BROWSER_URL names a subdomain of this site that Vercel
 * proxies through to Supabase; lib/supabase/client.ts points the browser
 * client at it, and the rewrite below carries every path across.
 *
 * That subdomain's first label MUST be the Supabase project ref. supabase-js
 * derives the session cookie name from the hostname:
 *
 *   `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
 *
 * so thgaokonzsabpvhfbfdy.henrymathclassroom.com yields exactly the cookie the
 * server components already read. Any other name silently signs everyone out
 * and bounces them back to /login — the auth helpers give no way to pin the
 * key by hand, because createClientComponentClient replaces options.auth
 * wholesale (auth-helpers-nextjs 0.10, dist/index.js:62).
 *
 * Server code is deliberately left alone: NEXT_PUBLIC_SUPABASE_URL still
 * points straight at Supabase, so service-role calls never cross the proxy.
 */
const directUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const browserUrl = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL

/** The proxy rule, or nothing at all when the browser URL is unset. */
function supabaseProxyRewrites() {
  if (!directUrl || !browserUrl) return []

  let proxyHost
  try {
    proxyHost = new URL(browserUrl).host
  } catch {
    return []
  }

  // Same host on both sides means there is nothing to proxy.
  if (proxyHost === new URL(directUrl).host) return []

  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: proxyHost }],
      destination: `${directUrl.replace(/\/$/, '')}/:path*`,
    },
  ]
}

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
      // Storage URLs now come back pointing at the proxy subdomain.
      {
        protocol: 'https',
        hostname: '**.henrymathclassroom.com',
      },
    ],
  },
  async rewrites() {
    // beforeFiles, so the proxy host never falls through to a page of ours.
    return {
      beforeFiles: supabaseProxyRewrites(),
      afterFiles: [],
      fallback: [],
    }
  },
}

module.exports = nextConfig
