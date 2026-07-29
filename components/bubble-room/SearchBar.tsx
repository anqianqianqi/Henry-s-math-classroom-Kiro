'use client'

/**
 * SearchBar — debounced keyword search input for the Bubble Room.
 *
 * On focus (empty or typed), shows a suggestion dropdown with up to 5 items
 * drawn from the `suggestions` prop (already-loaded in-memory questions).
 * A "Show more" button at the bottom triggers `onLoadMore(query, offset)`
 * which hits the server for paginated results — no extra DB call until then.
 *
 * Requirements: 4.1, 4.2, 4.4, 4.6
 */

import { useEffect, useRef, useState } from 'react'
import type { BubbleQuestion } from '@/lib/types/bubbleRoom'

export interface SearchBarProps {
  /** Current search value (controlled) */
  value: string
  /** Called with debounced value whenever the user pauses typing (300 ms) */
  onChange: (query: string) => void
  /** All in-memory questions — first 5 matching are shown as suggestions */
  suggestions?: BubbleQuestion[]
  /**
   * Called when the user clicks "Show more".
   * Receives the current query and the next offset to fetch from.
   * Returns { questions, hasMore } or signals completion.
   */
  onLoadMore?: (query: string, offset: number) => Promise<{ questions: BubbleQuestion[]; hasMore: boolean } | null>
  /** Called when the user selects a suggestion from the dropdown */
  onSuggestionClick?: (q: BubbleQuestion) => void
  /** Maximum character length — defaults to 200 (Req 4.1) */
  maxLength?: number
  /** Placeholder text */
  placeholder?: string
  /** Error message to display inline (Req 4.6) */
  error?: string
}

const SUGGESTIONS_PAGE = 5

export function SearchBar({
  value,
  onChange,
  suggestions = [],
  onLoadMore,
  onSuggestionClick,
  maxLength = 200,
  placeholder = 'Search questions…',
  error,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [extraResults, setExtraResults] = useState<BubbleQuestion[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(SUGGESTIONS_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external value changes (e.g., cleared by parent)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Reset extra results when query changes
  useEffect(() => {
    setExtraResults([])
    setNextOffset(SUGGESTIONS_PAGE)
    setHasMore(false)
  }, [localValue])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // ── Compute visible suggestions ──────────────────────────────────────────
  // Filter from in-memory list first (no DB call)
  const keyword = localValue.trim().toLowerCase()
  const filtered = keyword
    ? suggestions.filter(
        (q) =>
          q.text.toLowerCase().includes(keyword) ||
          (q.title ?? '').toLowerCase().includes(keyword),
      )
    : suggestions

  // First page: up to 5 from memory. After "Show more", append extraResults.
  const firstPage = filtered.slice(0, SUGGESTIONS_PAGE)
  const allVisible = [...firstPage, ...extraResults]

  // Show "Show more" if:
  //  - memory has more items beyond the first 5, OR
  //  - server told us there are more after a load-more call
  const memoryHasMore = filtered.length > SUGGESTIONS_PAGE
  const showLoadMore = (memoryHasMore || hasMore) && !!onLoadMore

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setLocalValue(newValue)
    setIsOpen(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(newValue)
    }, 300)
  }

  function handleFocus() {
    setIsOpen(true)
  }

  function handleClear() {
    setLocalValue('')
    setIsOpen(false)
    setExtraResults([])
    setHasMore(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange('')
  }

  function handleSelect(q: BubbleQuestion) {
    setIsOpen(false)
    onSuggestionClick?.(q)
  }

  async function handleLoadMore() {
    if (!onLoadMore || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const result = await onLoadMore(localValue, nextOffset)
      if (result) {
        setExtraResults((prev) => {
          // Deduplicate against firstPage ids
          const firstPageIds = new Set(firstPage.map((q) => q.id))
          const prevIds = new Set(prev.map((q) => q.id))
          const fresh = result.questions.filter(
            (q) => !firstPageIds.has(q.id) && !prevIds.has(q.id),
          )
          return [...prev, ...fresh]
        })
        setHasMore(result.hasMore)
        setNextOffset((o) => o + SUGGESTIONS_PAGE)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showDropdown = isOpen && allVisible.length > 0

  // ── Highlight match ───────────────────────────────────────────────────────
  function highlight(text: string): React.ReactNode {
    if (!keyword) return text
    const idx = text.toLowerCase().indexOf(keyword)
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic font-semibold">
          {text.slice(idx, idx + keyword.length)}
        </mark>
        {text.slice(idx + keyword.length)}
      </>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400 pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Search questions"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          role="combobox"
          className={`
            w-full pl-10 pr-10 py-2.5
            rounded-xl border
            text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
            transition-colors
            ${error
              ? 'border-red-400 bg-red-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
            }
          `}
        />

        {localValue.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ── Suggestion dropdown ───────────────────────────────────────────── */}
      {showDropdown && (
        <ul
          role="listbox"
          aria-label="Question suggestions"
          className="
            absolute z-50 top-full left-0 right-0 mt-1
            bg-white rounded-xl border border-gray-100
            shadow-lg overflow-hidden
          "
        >
          {allVisible.map((q) => {
            const label = q.title ?? q.text
            const preview =
              q.title && q.text.length > 60
                ? q.text.slice(0, 59) + '…'
                : q.title
                  ? q.text
                  : null
            return (
              <li key={q.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // prevent blur from firing before click
                    e.preventDefault()
                    handleSelect(q)
                  }}
                  className="
                    w-full text-left px-4 py-3
                    hover:bg-purple-50 focus:bg-purple-50
                    focus:outline-none
                    border-b border-gray-50 last:border-0
                    transition-colors
                  "
                >
                  <p className="text-sm font-medium text-gray-900 leading-snug truncate">
                    {highlight(label)}
                  </p>
                  {preview && (
                    <p className="text-xs text-gray-400 leading-snug mt-0.5 truncate">
                      {highlight(preview)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{q.author_display_name}</span>
                    {q.response_count > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          💬 {q.response_count}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            )
          })}

          {/* Show more button */}
          {showLoadMore && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleLoadMore()
                }}
                disabled={isLoadingMore}
                className="
                  w-full text-center px-4 py-2.5
                  text-xs font-semibold text-primary-600
                  hover:bg-purple-50 focus:bg-purple-50 focus:outline-none
                  border-t border-gray-100
                  transition-colors
                  disabled:opacity-50
                "
              >
                {isLoadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    Loading…
                  </span>
                ) : (
                  'Show more'
                )}
              </button>
            </li>
          )}
        </ul>
      )}

      {/* ── Inline error ──────────────────────────────────────────────────── */}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {localValue.length > maxLength * 0.85 && (
        <p className="mt-1 text-xs text-gray-400 text-right">
          {localValue.length}/{maxLength}
        </p>
      )}
    </div>
  )
}
