// components/pet/AccessoryInventory.tsx
// Lists owned accessories with equip/unequip toggles.
// Shows an empty-state message directing to the shop when no accessories are owned.

'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { AccessoryItem } from '@/lib/types/pet'

interface AccessoryInventoryProps {
  accessories: AccessoryItem[]
  equippedIds: string[]
  onEquip: (id: string) => void
  onUnequip: (id: string) => void
  className?: string
}

export default function AccessoryInventory({
  accessories,
  equippedIds,
  onEquip,
  onUnequip,
  className = '',
}: AccessoryInventoryProps) {
  if (accessories.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center ${className}`}
        role="status"
        aria-label="No accessories owned"
      >
        <span className="text-4xl" aria-hidden="true">🎒</span>
        <p className="text-sm text-gray-500">
          No accessories yet —{' '}
          <Link
            href="/shop"
            className="font-semibold text-violet-600 underline underline-offset-2 hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 rounded"
          >
            visit the Shop
          </Link>{' '}
          to get some!
        </p>
      </div>
    )
  }

  return (
    <ul
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 ${className}`}
      aria-label="Accessory inventory"
    >
      {accessories.map((item) => {
        const isEquipped = equippedIds.includes(item.id)

        return (
          <li
            key={item.id}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200 ${
              isEquipped
                ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-100'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {/* Equipped checkmark badge */}
            {isEquipped && (
              <span
                className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-xs text-white"
                aria-label="Equipped"
              >
                ✓
              </span>
            )}

            {/* Accessory image or placeholder */}
            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-gray-100">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-2xl"
                  aria-hidden="true"
                >
                  🎀
                </div>
              )}
            </div>

            {/* Accessory name */}
            <p className="w-full truncate text-center text-xs font-medium text-gray-700">
              {item.title}
            </p>

            {/* Equip / Unequip toggle button */}
            <button
              type="button"
              onClick={() => (isEquipped ? onUnequip(item.id) : onEquip(item.id))}
              className={`w-full rounded-lg px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                isEquipped
                  ? 'bg-violet-100 text-violet-700 hover:bg-violet-200 focus-visible:ring-violet-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:ring-gray-400'
              }`}
              aria-pressed={isEquipped}
              aria-label={isEquipped ? `Unequip ${item.title}` : `Equip ${item.title}`}
            >
              {isEquipped ? 'Unequip' : 'Equip'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
