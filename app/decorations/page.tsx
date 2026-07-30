'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

export default function DecorationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)
        .is('class_id', null)
      const admin = (roles as any[])?.some(r => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
      setIsAdmin(!!admin)
    }
    checkRole()
  }, [])

  const decorations = [
    {
      icon: '📖',
      title: 'Book Cover & Page',
      subtitle: 'Customise your challenge book',
      href: '/book-skins',
      description: 'Choose cover skins and page styles for the book that appears on every challenge.',
    },
    {
      icon: '🏠',
      title: 'Pet Room',
      subtitle: "Your pet's home background",
      href: '/decorations/pet-room',
      description: 'Browse and select room backgrounds for your pet area on the dashboard.',
    },
  ]

  const adminItems = [
    {
      icon: '🏛️',
      title: 'ChallengeRoom',
      subtitle: 'Admin: 3D room designer',
      href: '/admin/challenge-rooms',
      description: 'Generate a challenge room background with AI, then position the animated book on the table and save it.',
    },
    {
      icon: '🖼️',
      title: 'Upload Book Skins',
      subtitle: 'Admin: manage skins',
      href: '/admin/book-skins',
      description: 'Upload cover and page skins, set visibility, set as default, and sell in the shop.',
    },
    {
      icon: '✨',
      title: 'Generate Pet Room',
      subtitle: 'Admin: AI room generator',
      href: '/decorations/pet-room?panel=generate',
      description: 'Generate anime-style pet room backgrounds with AI. Iterate until happy, then save to the collection.',
    },
    {
      icon: '📸',
      title: 'Upload Pet Room',
      subtitle: 'Admin: custom room image',
      href: '/decorations/pet-room?panel=upload',
      description: 'Upload a custom room background image (1536×1024 landscape recommended).',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader breadcrumbs={[{ label: 'Decorations' }]} />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500 mb-8">Personalise your classroom experience.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {decorations.map(d => (
            <Card key={d.href} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push(d.href)}>
              <Card.Body>
                <div className="text-5xl mb-4">{d.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{d.title}</h3>
                <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide mb-2">{d.subtitle}</p>
                <p className="text-sm text-gray-500">{d.description}</p>
              </Card.Body>
            </Card>
          ))}
        </div>

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <h2 className="text-lg font-bold text-gray-700 mt-10 mb-4 flex items-center gap-2">
              <span>🔧</span> Admin Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {adminItems.map(d => (
                <Card key={d.href} className="cursor-pointer hover:shadow-lg transition-shadow border-amber-200 bg-amber-50" onClick={() => router.push(d.href)}>
                  <Card.Body>
                    <div className="text-5xl mb-4">{d.icon}</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{d.title}</h3>
                    <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-2">{d.subtitle}</p>
                    <p className="text-sm text-gray-500">{d.description}</p>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
