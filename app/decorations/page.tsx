'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function DecorationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const { t, pick } = useLanguage()

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
      title: t('decor.bookCoverPage'),
      subtitle: pick('Customise your challenge book', '自定义你的挑战书'),
      href: '/book-skins',
      description: pick(
        'Choose cover skins and page styles for the book that appears on every challenge.',
        '为每道挑战题中出现的书本选择封面与内页样式。',
      ),
    },
    {
      icon: '🏛️',
      title: t('decor.challengeRoom'),
      subtitle: pick('Your 3D reading room', '你的 3D 阅读房间'),
      href: '/challenge-rooms',
      description: pick(
        'Swap the flat book for a 3D room with an animated book, and pick the cover / inner-page bundle that wraps it.',
        '把平面书本换成带动画书本的 3D 房间，并选择包裹它的封面与内页组合。',
      ),
    },
    {
      icon: '🏠',
      title: t('decor.petRoom'),
      subtitle: pick("Your pet's home background", '宠物的家园背景'),
      href: '/decorations/pet-room',
      description: pick(
        'Browse and select room backgrounds for your pet area on the dashboard.',
        '浏览并选择主页宠物区域的房间背景。',
      ),
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
      icon: '📚',
      title: 'Upload BookSkinBundle',
      subtitle: 'Admin: ChallengeRoom textures',
      href: '/admin/book-bundles',
      description: 'Design a matched cover + inner-page pair that wraps the 3D book. Only used by the ChallengeRoom — for the flat book, use Upload Book Skins.',
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
        <p className="text-gray-500 mb-8">{pick('Personalise your classroom experience.', '个性化你的课堂体验。')}</p>

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
              <span>🔧</span> {t('decor.adminTools')}
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
