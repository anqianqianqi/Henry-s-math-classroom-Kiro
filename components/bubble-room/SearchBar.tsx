'use client'

/**
 * SearchBar — debounced keyword search input for the Bubble Room.
 *
 * Controlled component: parent owns the value, SearchBar fires onChange
 * after a 300 ms debounce. Does NOT debounce the visual input — only the
 * outbound callback.
 *
 * Requirements: 4.1, 4.2, 4.4, 4.6
 */

import { useEffect, useRef, useState } from 'react'

export interface SearchBarProps {
  /** Current search value (controlled) */
  value: string
  /** Called with debounced value whenever the user pauses typing (300 ms) */
  onChange: (query: string) => void
  /** Maximum character length — defaults to 200 (Req 4.1) */
  maxLength?: number
  /** Placeholder text */
  placeholder?: string
  /** Error message to display inline (Req 4.6) */
  error?: string
}

/**
 * SearchBar with a 300 ms debounce on the onChange callback.
 *
 * @example
 * <SearchBar value={query} onChange={setQuery} />
 */
export function SearchBar({
  value,
  onChange,
  maxLength = 200,
  placeholder = 'Search questions…',
  error,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external value changes (e.g., cleared by parent)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setLocalValue(newValue)

    // Clear any pending debounce
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      onChange(newValue)
    }, 300)
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleClear() {
    setLocalValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange('')
  }

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {/* Search icon */}
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
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Search questions"
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

        {/* Clear button — shown when there is input */}
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

      {/* Inline error (Req 4.6) */}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Character counter — subtle, shown when near the limit */}
      {localValue.length > maxLength * 0.85 && (
        <p className="mt-1 text-xs text-gray-400 text-right">
          {localValue.length}/{maxLength}
        </p>
      )}
    </div>
  )
}
