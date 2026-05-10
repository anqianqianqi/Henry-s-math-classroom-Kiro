'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'

export interface TagOption {
  id: string
  name: string // display name in current language
}

interface TagInputProps {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  availableTags: TagOption[]
  placeholder?: string
}

export default function TagInput({ selectedTagIds, onChange, availableTags, placeholder = 'Search tags...' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedTags = availableTags.filter(t => selectedTagIds.includes(t.id))
  const unselectedTags = availableTags.filter(t => !selectedTagIds.includes(t.id))
  const filteredTags = input.trim()
    ? unselectedTags.filter(t =>
        t.name.toLowerCase().includes(input.toLowerCase()) ||
        (t as any)._allNames?.some((n: string) => n.toLowerCase().includes(input.toLowerCase()))
      )
    : unselectedTags

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addTag(tagId: string) {
    if (!selectedTagIds.includes(tagId)) {
      onChange([...selectedTagIds, tagId])
    }
    setInput('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  function removeTag(tagId: string) {
    onChange(selectedTagIds.filter(id => id !== tagId))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !input && selectedTagIds.length > 0) {
      removeTag(selectedTagIds[selectedTagIds.length - 1])
    }
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Input with selected tags */}
      <div className="relative">
        <div
          className="min-h-[44px] flex flex-wrap gap-2 p-2 border-2 border-gray-200 rounded-xl
                     focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200
                     transition-colors bg-white cursor-text"
          onClick={() => { inputRef.current?.focus(); setShowDropdown(true) }}
        >
          {selectedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
            >
              {tag.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag.id) }}
                className="ml-1 text-primary-400 hover:text-primary-800 leading-none text-base"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? placeholder : 'Add more...'}
            className="flex-1 min-w-[100px] outline-none text-sm bg-transparent py-1 px-1"
          />
        </div>

        {/* Dropdown */}
        {showDropdown && filteredTags.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
            {filteredTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(tag.id) }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 text-gray-700 flex items-center justify-between"
              >
                <span>{tag.name}</span>
                <span className="text-xs text-gray-400 font-mono">
                  {(tag as any)._allNames?.filter((n: string) => n !== tag.name).join(' / ') || ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick-add pills */}
      {unselectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center mr-1">Quick add:</span>
          {unselectedTags.slice(0, 10).map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.id)}
              className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-primary-100 hover:text-primary-700 transition-colors"
            >
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
