// lib/types/pet.ts
// TypeScript types for the Virtual Pet feature.
// All pet state is stored in the student_pets table.
// Accessory inventory is derived from redemptions filtered by category = 'accessory'.

export type Species = 'dragon' | 'fox' | 'cat'
export type EvolutionStage = 'egg' | 'baby' | 'teen' | 'adult' | 'legendary'
export type PetAnimation = 'idle' | 'happy' | 'none'

export interface StudentPet {
  id: string
  user_id: string
  species: Species | null          // null while in egg stage (species not yet selected)
  xp: number
  evolution_stage: EvolutionStage
  equipped_accessories: string[]   // array of shop_item UUIDs
  created_at: string
  updated_at: string
}

export interface AccessoryItem {
  id: string
  title: string
  image_url: string | null
}
