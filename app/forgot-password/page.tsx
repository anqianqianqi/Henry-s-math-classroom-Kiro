'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Card } from '@/components/ui/Card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Henry&apos;s Math Classroom</h1>
          <p className="mt-2 text-gray-600">Reset your password</p>
        </div>

        <Card>
          <Card.Body>
            {sent ? (
              <div className="text-center py-4 space-y-3">
                <div className="text-4xl">📧</div>
                <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
                <p className="text-gray-600 text-sm">
                  We sent a password reset link to <span className="font-medium">{email}</span>.
                  Check your inbox and click the link to set a new password.
                </p>
                <p className="text-xs text-gray-400">Didn&apos;t get it? Check your spam folder.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>

                <FormField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full"
                >
                  Send Reset Link
                </Button>
              </form>
            )}
          </Card.Body>
          <Card.Footer>
            <p className="text-sm text-center text-gray-600">
              Remember your password?{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                Sign in
              </a>
            </p>
          </Card.Footer>
        </Card>
      </div>
    </div>
  )
}
