'use client'

/**
 * A review window for the solution editor.
 *
 * The four things the editor has to get right are each hard to judge from
 * code, so each gets a panel: type on the left, and watch what would be
 * stored, what the translation engine would be handed, what a reader would
 * see, and what the student would meet on coming back to edit.
 *
 * Nothing here writes to the database. It is a place to look at the design
 * before it goes anywhere near a student's submission — this repo has one
 * production Supabase and no staging, so "try it on the real page" is not a
 * thing that can be done safely.
 */

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { PageHeader } from '@/components/ui/PageHeader'
import { SolutionEditor } from '@/components/solution/SolutionEditor'
import { SolutionView } from '@/components/solution/SolutionView'
import { maskMath } from '@/lib/mathtext-core'
import { parseRows } from '@/lib/solution/rows'
import { latexToShorthand } from '@/lib/solution/shorthand'
import type { TranslationKey } from '@/lib/i18n/catalog'

/**
 * Starting points, chosen to exercise the cases that decide the design.
 *
 * `money` is not a joke: `$12 ... $5` tokenises as an equation today, and this
 * site has a shop with balances, so a student writing about points really can
 * hit it. `old` is a submission in the format that already exists in the
 * database, which must keep working untouched.
 */
const SAMPLES: { key: TranslationKey; content: string }[] = [
  {
    key: 'lab.sampleWorked',
    content: [
      'We know the two sides are equal, so subtract c from both sides:',
      '$a+b=c+d$',
      '$a+b-c=d$',
      'Since $a>c$, what is left on the left is smaller, so:',
      '$b<d$',
    ].join('\n'),
  },
  { key: 'lab.sampleMoney', content: 'I had $12 and spent $5 on a shop item.' },
  { key: 'lab.sampleOld', content: 'b is less than d because a is bigger than c' },
  {
    key: 'lab.sampleGeometry',
    content: ['The two angles are equal:', '\\angle', '$\\frac{1}{2} \\times 180 = 90$'].join('\n'),
  },
]

function Panel({
  titleKey,
  noteKey,
  children,
}: {
  titleKey: TranslationKey
  noteKey?: TranslationKey
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <section className="rounded-2xl border border-[rgba(100,60,10,0.18)] bg-[rgba(255,252,242,0.55)] p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#4a2c00]">{t(titleKey)}</h2>
      {noteKey && <p className="mt-1 mb-3 text-xs leading-relaxed text-[rgba(100,60,10,0.65)]">{t(noteKey)}</p>}
      <div className={noteKey ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

export default function SolutionLabPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [content, setContent] = useState(SAMPLES[0].content)
  /** Bumped to remount the editor, which seeds its rows once from `content`. */
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)

      const names = (roles as any[] ?? []).map(r => r.roles?.name)
      setAllowed(names.some(n => n === 'administrator' || n === 'admin' || n === 'teacher'))
      setChecking(false)
    }
    check()
  }, [])

  if (checking) return null
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <p className="text-center text-gray-600">{t('admin.teachersOnly')}</p>
      </div>
    )
  }

  const { masked } = maskMath(content)
  const rows = parseRows(content)

  return (
    <>
      {/* Outside the padded column: the header sticks to the top and brings
          its own max-width container. */}
      <PageHeader breadcrumbs={[{ label: t('lab.solutionTitle') }]} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <p className="mb-4 text-sm text-[rgba(100,60,10,0.7)]">{t('lab.solutionSubtitle')}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(100,60,10,0.6)]">
          {t('lab.samples')}
        </span>
        {SAMPLES.map(sample => (
          <button
            key={sample.key}
            type="button"
            onClick={() => { setContent(sample.content); setSeed(n => n + 1) }}
            className="px-3 py-1.5 rounded-lg text-xs text-[#4a2c00]
                       border border-[rgba(100,60,10,0.25)] bg-[rgba(255,252,242,0.7)]
                       hover:border-[rgba(100,60,10,0.5)] transition-colors"
          >
            {t(sample.key)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel titleKey="lab.editor">
          <SolutionEditor key={seed} value={content} onChange={setContent} />
        </Panel>

        <div className="space-y-4">
          <Panel titleKey="lab.reader">
            {content.trim()
              ? <SolutionView content={content} className="text-[#2d1a00]" />
              : <p className="text-sm text-[rgba(100,60,10,0.5)]">{t('lab.empty')}</p>}
          </Panel>

          <Panel titleKey="lab.stored" noteKey="lab.storedWhy">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono text-[rgba(100,60,10,0.8)]">
              {content || '—'}
            </pre>
          </Panel>

          <Panel titleKey="lab.translator" noteKey="lab.translatorWhy">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono text-[rgba(100,60,10,0.8)]">
              {masked || '—'}
            </pre>
          </Panel>

          <Panel titleKey="lab.reopened" noteKey="lab.reopenedWhy">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono text-[rgba(100,60,10,0.8)]">
              {rows
                .map(row => (row.kind === 'math' ? latexToShorthand(row.latex) : row.value))
                .filter(line => line.trim())
                .join('\n') || '—'}
            </pre>
          </Panel>
        </div>
      </div>
      </div>
    </>
  )
}
