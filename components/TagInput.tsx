'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
}

export default function TagInput({ tags, onChange, placeholder = 'Type a tag...', suggestions = [] }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addTag(value: string) {
    const tag = value.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div
            className="min-h-[44px] flex flex-wrap gap-2 p-2 border-2 border-gray-200 rounded-xl
                       focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200
                       transition-colors bg-white cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700
                           rounded-full text-sm font-medium"
              >
                #{tag}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                  className="ml-1 text-primary-400 hover:text-primary-800 leading-none text-base"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              onBlur={() => { setTimeout(() => { if (input.trim() && !showSuggestions) addTag(input) }, 200) }}
              placeholder={tags.length === 0 ? placeholder : 'Add another...'}
              className="flex-1 min-w-[100px] outline-none text-sm bg-transparent py-1 px-1"
            />
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && input.length > 0 && filteredSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-40 overflow-y-auto">
              {filteredSuggestions.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addTag(suggestion) }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 text-gray-700"
                >
                  #{suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add button */}
        <button
          type="button"
          onClick={() => addTag(input)}
          disabled={!input.trim()}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl
                     hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors shrink-0"
        >
          + Add
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400">
        Type to search existing tags or create new ones. Press{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd>{' '}
        or click <span className="font-medium text-gray-500">+ Add</span> to add.
      </p>
    </div>
  )
}
