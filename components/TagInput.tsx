'use client'

import { useState, KeyboardEvent, useRef } from 'react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput({ tags, onChange, placeholder = 'Type a tag...' }: TagInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const tag = value.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInput('')
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
    <div className="space-y-2">
      {/* Input row */}
      <div className="flex gap-2">
        <div
          className="flex-1 min-h-[44px] flex flex-wrap gap-2 p-2 border-2 border-gray-200 rounded-xl
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
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (input.trim()) addTag(input) }}
            placeholder={tags.length === 0 ? placeholder : 'Add another...'}
            className="flex-1 min-w-[100px] outline-none text-sm bg-transparent py-1 px-1"
          />
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
        Type a tag and click <span className="font-medium text-gray-500">+ Add</span> or press{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd>{' '}
        to add it. Add as many as you like.
      </p>
    </div>
  )
}
