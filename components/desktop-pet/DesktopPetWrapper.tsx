// components/desktop-pet/DesktopPetWrapper.tsx
// Lazy-loads DesktopPet client-side only to avoid SSR issues with
// window/position calculations.

'use client'

import dynamic from 'next/dynamic'

const DesktopPet = dynamic(() => import('./DesktopPet'), {
  ssr: false,
})

export default function DesktopPetWrapper() {
  return <DesktopPet />
}
