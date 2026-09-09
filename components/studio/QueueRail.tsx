'use client'

/**
 * The left column of the desk: what is waiting, and the filters that narrow it.
 *
 * Grouped by problem because that is how a teacher marks: the same question
 * across the class, not the same student across questions. The row shows only
 * what decides where to look next: who, how long ago, and what the assistant
 * thinks, as a chip whose colour is its confidence.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { confidenceBand, type QueueGroup, type QueueRow } from '@/lib/studio/queue'

export interface ClassOption {
  id: string
  name: string
}

export interface RailFilters {
  classId: string
  from: string
  to: string
  search: string
}

export interface BatchState {
  running: boolean
  done: number
  total: number
}

export interface QueueRailProps {
  groups: QueueGroup[]
  /** Rows after filtering, for the count. */
  shown: number
  /** Every pending row, before filtering, for the badge. */
  pendingTotal: number
  mode: 'pending' | 'graded'
  onMode: (mode: 'pending' | 'graded') => void
  activeId: string | null
  onSelect: (id: string) => void
  classes: ClassOption[]
  filters: RailFilters
  onFilters: (filters: RailFilters) => void
  timeAgo: (iso: string) => string
  batch: BatchState
  /** Pending rows the assistant has not seen and can grade. */
  runnable: number
  onRunAll: () => void
  onStopBatch: () => void
  onRefresh: () => void
  loading: boolean
}

function TaChip({ row }: { row: QueueRow }) {
  const { t } = useLanguage()
  if (!row.ta) return null
  const band = confidenceBand(row.ta.confidence)
  return (
    <span
      className={`studio-chip studio-chip-${band}`}
      title={t('studio.taConfidence', { percent: Math.round(row.ta.confidence * 100) })}
    >
      {row.ta.suggestedScore}/{row.ta.maxScore} · {Math.round(row.ta.confidence * 100)}%
    </span>
  )
}

export function QueueRail(props: QueueRailProps) {
  const { t } = useLanguage()
  const { groups, filters, onFilters, batch } = props
  const filtered = !!(filters.classId || filters.from || filters.to || filters.search)
  const emptyKey = props.loading
    ? 'studio.loading'
    : filtered ? 'studio.emptyFiltered' : props.mode === 'pending' ? 'studio.emptyPending' : 'studio.emptyGraded'

  return (
    <aside className="studio-rail" aria-label={t('studio.title')}>
      <header className="studio-rail-head">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold leading-tight">{t('studio.title')}</h1>
            <p className="studio-muted text-xs mt-0.5">{t('studio.subtitle')}</p>
          </div>
          <button type="button" className="studio-btn studio-btn-sm" onClick={props.onRefresh} title={t('studio.refresh')}>
            ↻
          </button>
        </div>
        <div className="mt-3 flex gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={props.mode === 'pending'}
            className={`studio-tab ${props.mode === 'pending' ? 'studio-tab-active' : ''}`}
            onClick={() => props.onMode('pending')}
          >
            {t('studio.pendingMode')}
            <span className="studio-count">{props.pendingTotal}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.mode === 'graded'}
            className={`studio-tab ${props.mode === 'graded' ? 'studio-tab-active' : ''}`}
            onClick={() => props.onMode('graded')}
          >
            {t('studio.gradedMode')}
          </button>
        </div>
      </header>

      <div className="studio-filters">
        <input
          type="search"
          className="studio-input w-full"
          placeholder={t('studio.search')}
          value={filters.search}
          onChange={e => onFilters({ ...filters, search: e.target.value })}
          aria-label={t('studio.search')}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="studio-label col-span-2">
            <span>{t('studio.classFilter')}</span>
            <select
              className="studio-input w-full"
              value={filters.classId}
              onChange={e => onFilters({ ...filters, classId: e.target.value })}
            >
              <option value="">{t('studio.allClasses')}</option>
              {props.classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="studio-label">
            <span>{t('studio.from')}</span>
            <input type="date" className="studio-input w-full" value={filters.from}
              onChange={e => onFilters({ ...filters, from: e.target.value })} />
          </label>
          <label className="studio-label">
            <span>{t('studio.to')}</span>
            <input type="date" className="studio-input w-full" value={filters.to}
              onChange={e => onFilters({ ...filters, to: e.target.value })} />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="studio-muted text-xs">{t('studio.showing', { count: props.shown })}</span>
          {filtered && (
            <button type="button" className="studio-link text-xs"
              onClick={() => onFilters({ classId: '', from: '', to: '', search: '' })}>
              {t('studio.clearFilters')}
            </button>
          )}
        </div>
      </div>

      <div className="studio-rail-list" role="listbox" aria-label={t('studio.pendingMode')}>
        {groups.length === 0 ? (
          <p className="studio-muted p-4 text-sm">{t(emptyKey)}</p>
        ) : groups.map(group => (
          <section key={group.key} className="studio-group">
            <h2 className="studio-group-head">
              <span className="truncate">{group.title || (group.key === 'none' ? t('studio.deletedProblem') : t('studio.untitledProblem'))}</span>
              <span className="studio-count">{group.rows.length}</span>
            </h2>
            {group.rows.map(row => (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={row.id === props.activeId}
                aria-current={row.id === props.activeId ? 'true' : undefined}
                className="studio-row"
                onClick={() => props.onSelect(row.id)}
              >
                <span className="studio-row-name truncate">{row.studentName || t('studio.unknownStudent')}</span>
                <span className="studio-row-meta">
                  <span className="studio-muted">{props.timeAgo(row.submittedAt)}</span>
                  {row.isLocked && <span title={t('studio.locked')} aria-label={t('studio.locked')}>🔒</span>}
                  {props.mode === 'graded' && row.points !== null ? (
                    <span className="studio-chip">{t('studio.gradedChip', { score: row.points, max: row.maxPoints })}</span>
                  ) : (
                    <TaChip row={row} />
                  )}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>

      {props.mode === 'pending' && (
        <footer className="studio-rail-foot">
          {batch.running ? (
            <>
              <div className="studio-progress" role="progressbar" aria-valuemin={0} aria-valuemax={batch.total} aria-valuenow={batch.done}>
                <div className="studio-progress-fill" style={{ width: `${batch.total ? (batch.done / batch.total) * 100 : 0}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs">{t('studio.runAllProgress', { done: batch.done, total: batch.total })}</span>
                <button type="button" className="studio-btn studio-btn-sm" onClick={props.onStopBatch}>{t('studio.runAllStop')}</button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="studio-btn w-full"
              disabled={props.runnable === 0}
              onClick={props.onRunAll}
            >
              {t('studio.runAll', { count: props.runnable })}
            </button>
          )}
        </footer>
      )}
    </aside>
  )
}
