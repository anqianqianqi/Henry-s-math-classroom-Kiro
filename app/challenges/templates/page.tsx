'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import ChallengeTemplates from '@/components/ChallengeTemplates'

export default function TemplatesPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/challenges')}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">📝</span>
              <h1 className="text-2xl font-bold text-gray-900">Challenge Templates</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <ChallengeTemplates />
      </main>
    </div>
  )
}
