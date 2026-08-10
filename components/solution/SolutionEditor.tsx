'use client'

/**
 * A solution, written as a list of steps.
 *
 * The component owns rows; the caller owns a plain string. Everything that
 * reads a submission today — grading, All Student Submissions, translation,
 * search — goes on reading the same format it always did. See lib/solution/rows.ts
 * for why that matters more than it looks.
 *
 * Rows carry an id that survives reordering, because keying them by index
 * makes React reuse the wrong <input> when a step moves and the student
 * watches their text jump rows.
 */

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { parseRows, serialiseRows, emptyRow, type Row } from '@/lib/solution/rows'
import { MathRow } from './MathRow'

interface KeyedRow {
  id: number
  row: Row
}

let nextId = 1
const keyed = (rows: Row[]): KeyedRow[] => rows.map(row => ({ id: nextId++, row }))

export function SolutionEditor({
  value,
  onChange,
}: {
  /** The stored solution string. Read once, to seed the rows. */
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useLanguage()
  const [rows, setRows] = useState<KeyedRow[]>(() => {
    const parsed = parseRows(value).filter(row => row.kind === 'math' || row.value.trim())
    return keyed(parsed.length ? parsed : [])
  })
  /** The row to focus after an add — nothing else should steal the caret. */
  const [justAdded, setJustAdded] = useState<number | null>(null)

  function commit(next: KeyedRow[]) {
    setRows(next)
    onChange(serialiseRows(next.map(entry => entry.row)))
  }

  function add(kind: Row['kind']) {
    const entry = { id: nextId++, row: emptyRow(kind) }
    setJustAdded(entry.id)
    commit([...rows, entry])
  }

  function update(id: number, row: Row) {
    commit(rows.map(entry => (entry.id === id ? { ...entry, row } : entry)))
  }

  function remove(id: number) {
    commit(rows.filter(entry => entry.id !== id))
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by
    if (to < 0 || to >= rows.length) return
    const next = [...rows]
    ;[next[index], next[to]] = [next[to], next[index]]
    commit(next)
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-sm text-center py-4 text-[rgba(100,60,10,0.5)]">{t('solution.empty')}</p>
      )}

      {rows.map((entry, index) => (
        <div key={entry.id} className="group flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {entry.row.kind === 'math' ? (
              <MathRow
                latex={entry.row.latex}
                autoFocus={entry.id === justAdded}
                onChange={latex => update(entry.id, { kind: 'math', latex })}
              />
            ) : (
              <textarea
                value={entry.row.value}
                autoFocus={entry.id === justAdded}
                onChange={event => update(entry.id, { kind: 'text', value: event.target.value })}
                placeholder={t('solution.notePlaceholder')}
                rows={2}
                className="w-full p-3 rounded-xl resize-y bg-transparent
                           border border-[rgba(100,60,10,0.18)] text-[#2d1a00]
                           placeholder-[rgba(100,60,10,0.4)]
                           focus:border-[rgba(100,60,10,0.45)] focus:outline-none"
              />
            )}
          </div>

          {/*
            Always in the DOM, faded until the row is hovered or focused.
            Revealing them on hover alone would hide them completely on a
            phone, where there is no hover — and the app ships through
            Capacitor, so that is a real device, not a hypothetical.
          */}
          <div className="flex flex-col gap-1 pt-1 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              title={t('solution.moveUp')}
              aria-label={t('solution.moveUp')}
              className="w-7 h-7 rounded-lg text-xs text-[#4a2c00] disabled:opacity-25
                         hover:bg-[rgba(100,60,10,0.08)]"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === rows.length - 1}
              title={t('solution.moveDown')}
              aria-label={t('solution.moveDown')}
              className="w-7 h-7 rounded-lg text-xs text-[#4a2c00] disabled:opacity-25
                         hover:bg-[rgba(100,60,10,0.08)]"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(entry.id)}
              title={t('solution.removeStep')}
              aria-label={t('solution.removeStep')}
              className="w-7 h-7 rounded-lg text-xs text-[#4a2c00] hover:bg-[rgba(180,40,40,0.12)]"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => add('text')}
          className="px-3 py-2 rounded-xl text-sm text-[#4a2c00]
                     border border-dashed border-[rgba(100,60,10,0.3)]
                     hover:bg-[rgba(255,252,242,0.7)] transition-colors"
        >
          {t('solution.addNote')}
        </button>
        <button
          type="button"
          onClick={() => add('math')}
          className="px-3 py-2 rounded-xl text-sm text-[#4a2c00]
                     border border-dashed border-[rgba(100,60,10,0.3)]
                     hover:bg-[rgba(255,252,242,0.7)] transition-colors"
        >
          {t('solution.addEquation')}
        </button>
      </div>
    </div>
  )
}
