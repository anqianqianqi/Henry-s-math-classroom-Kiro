import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

/**
 * The browser's Supabase client.
 *
 * It talks to NEXT_PUBLIC_SUPABASE_BROWSER_URL when that is set — a subdomain
 * of this site that Vercel proxies through to Supabase, so students on
 * networks that cannot reach *.supabase.co still get a response. See the note
 * in next.config.js for why the subdomain's first label has to be the project
 * ref, and why server code keeps using NEXT_PUBLIC_SUPABASE_URL directly.
 *
 * Unset, this falls back to the direct URL and behaves exactly as before.
 */
export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  return createClientComponentClient<Database>({ supabaseUrl: url, supabaseKey: key })
}
