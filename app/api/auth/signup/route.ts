// app/api/auth/signup/route.ts
// Server-side signup that bypasses Supabase's email system.
// Uses Supabase Admin API to create users (no confirmation email sent by Supabase),
// then sends a branded confirmation email via Resend.
//
// Rate limiting: max 3 signup attempts per IP per hour (stored in memory).
// For production, replace with Redis or a DB-backed rate limiter.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

// In-memory rate limiter: { ip -> { count, resetAt } }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 3
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(ip)

    if (!allowed) {
      const minutesLeft = Math.ceil(retryAfterMs / 60000)
      return NextResponse.json(
        { error: `Too many signup attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, password, firstName, lastName, nickname } = body

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Use Supabase Admin API — does NOT send confirmation email
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // user must confirm via our email
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname?.trim() || null,
      },
    })

    if (signUpError) {
      // User already exists
      if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      console.error('[signup] Admin createUser error:', signUpError)
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    // Create profile row
    try {
      await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname?.trim() || null,
        email,
      })
    } catch (err) {
      console.error('[signup] Profile insert error:', err)
    }

    // Generate confirmation link via Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[signup] generateLink error:', linkError)
      // Account created but email failed — still return success, user can request resend
      return NextResponse.json({ ok: true, emailSent: false })
    }

    const confirmationUrl = linkData.properties.action_link

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'Henry\'s Math Classroom <noreply@henrymathclassroom.com>',
      to: email,
      subject: 'Confirm your account — Henry\'s Math Classroom',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
            Welcome to Henry's Math Classroom! 🎉
          </h1>
          <p style="color: #475569; margin-bottom: 24px;">
            Hi ${firstName}, thanks for signing up. Click the button below to confirm your email address and activate your account.
          </p>
          <a href="${confirmationUrl}"
             style="display: inline-block; background: #2563eb; color: white; font-weight: 600;
                    padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 15px;">
            Confirm my account
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    if (emailError) {
      console.error('[signup] Resend error:', emailError)
      return NextResponse.json({ ok: true, emailSent: false })
    }

    return NextResponse.json({ ok: true, emailSent: true })
  } catch (err) {
    console.error('[signup] Unhandled error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
