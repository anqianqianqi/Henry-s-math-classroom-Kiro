'use client'

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

export default function DecorationsPage() {
  const router = useRouter()

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
      subtitle: 'Your pet\'s home background',
      href: '/decorations/pet-room',
      description: 'Browse and select room backgrounds for your pet area on the dashboard.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={[{ label: 'Decorations' }]}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500 mb-8">Personalise your classroom experience.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {decorations.map(d => (
            <Card
              key={d.href}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(d.href)}
            >
              <Card.Body>
                <div className="text-5xl mb-4">{d.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{d.title}</h3>
                <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide mb-2">{d.subtitle}</p>
                <p className="text-sm text-gray-500">{d.description}</p>
              </Card.Body>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
