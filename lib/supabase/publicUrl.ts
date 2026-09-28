/**
 * Storage URLs that end up in the database are read back by a browser, so they
 * have to name a host the browser can reach. Students in mainland China cannot
 * reach *.supabase.co, and a stored URL outlives the request that made it — so
 * a URL written with the direct host stays broken for them forever.
 *
 * Server code keeps talking to Supabase directly (see next.config.js), which
 * means getPublicUrl() hands back the direct host. Pass the result through
 * here before storing it, or before sending it to a page.
 *
 * With NEXT_PUBLIC_SUPABASE_BROWSER_URL unset this returns the URL untouched,
 * so the fallback is the behaviour we had before any of this existed.
 */

function origin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Swap the direct Supabase origin for the one the browser can reach.
 * Anything that isn't a Supabase URL is returned as it came in.
 */
export function toBrowserPublicUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url

  const direct = origin(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const browser = origin(process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL)
  if (!direct || !browser || direct === browser) return url

  return (url.startsWith(direct) ? browser + url.slice(direct.length) : url) as T
}
