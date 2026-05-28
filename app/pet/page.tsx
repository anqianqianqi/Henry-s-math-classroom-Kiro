'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Species, EvolutionStage, StudentPet, AccessoryItem, PetAnimation } from '@/lib/types/pet'
import { equipAccessory, unequipAccessory, computeEvolutionStage } from '@/lib/utils/pet'
import EggSvg from '@/components/pet/EggSvg'
import PetSvg from '@/components/pet/PetSvg'
import BackgroundScene from '@/components/pet/BackgroundScene'
import XpBar from '@/components/pet/XpBar'
import AccessoryInventory from '@/components/pet/AccessoryInventory'
import SpeciesSelector from '@/components/pet/SpeciesSelector'
import EvolutionSparkle from '@/components/pet/EvolutionSparkle'

interface PendingFeeding {
  id: string
  food_xp: number
  item_title: string
  created_at: string
}

/** Human-readable label for each evolution stage + species combination. */
function getStageLabel(species: Species | null, stage: string): string {
  const speciesName =
    species === 'dragon' ? 'Dragon'
    : species === 'fox'    ? 'Fox'
    : species === 'cat'    ? 'Cat'
    : 'Pet'

  switch (stage) {
    case 'baby':      return `Baby ${speciesName}`
    case 'teen':      return `Teen ${speciesName}`
    case 'adult':     return `Adult ${speciesName}`
    case 'legendary': return `Legendary ${speciesName}`
    default:          return speciesName
  }
}

export default function PetPage() {
  const [loading, setLoading] = useState(true)
  const [pet, setPet] = useState<StudentPet | null>(null)
  const [accessories, setAccessories] = useState<AccessoryItem[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [pendingFeedings, setPendingFeedings] = useState<PendingFeeding[]>([])
  const [feeding, setFeeding] = useState<string | null>(null) // feeding_id being processed
  const [sparkleActive, setSparkleActive] = useState(false)
  const [speciesError, setSpeciesError] = useState<string | null>(null)
  const [accessoryError, setAccessoryError] = useState<string | null>(null)
  const [petAnimation, setPetAnimation] = useState<PetAnimation>('idle')
  const [xpGainedLabel, setXpGainedLabel] = useState<number | null>(null)
  const [xpLabelVisible, setXpLabelVisible] = useState(false)
  const [evolvedFrom, setEvolvedFrom] = useState<string | null>(null) // stage before feeding
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [restartError, setRestartError] = useState<string | null>(null)
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xpLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    checkAuth()
    return () => {
      if (sparkleTimerRef.current) clearTimeout(sparkleTimerRef.current)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
      if (xpLabelTimerRef.current) clearTimeout(xpLabelTimerRef.current)
    }
  }, [])

  async function checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      router.push('/login')
      return
    }

    // Check if user has the student role (non-students are redirected to /dashboard)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .is('class_id', null)

    let isStudent = true

    if (userRoles && userRoles.length > 0) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('name')
        .in('id', userRoles.map((r: { role_id: string }) => r.role_id))

      const hasTeacherRole = roleData?.some((r: { name: string }) => r.name === 'teacher') || false
      const hasAdminRole = roleData?.some((r: { name: string }) => r.name === 'administrator') || false

      if (hasTeacherRole || hasAdminRole) {
        isStudent = false
      }
    }

    if (!isStudent) {
      router.push('/dashboard')
      return
    }

    await Promise.all([
      initializePet(user.id),
      loadAccessories(user.id),
      loadBalance(user.id),
      loadPendingFeedings(user.id),
    ])
    setLoading(false)
  }

  async function initializePet(userId: string) {
    // Query for existing student_pets row
    const { data: existingPet, error: fetchError } = await supabase
      .from('student_pets')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" — any other error is unexpected
      console.error('Error fetching pet:', fetchError)
      return
    }

    if (existingPet) {
      setPet(existingPet as StudentPet)
      return
    }

    // No row exists — create one with defaults
    const { data: newPet, error: insertError } = await supabase
      .from('student_pets')
      .insert({
        user_id: userId,
        evolution_stage: 'egg',
        xp: 0,
        species: null,
        equipped_accessories: [],
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating pet:', insertError)
      return
    }

    setPet(newPet as StudentPet)
  }

  /**
   * Loads the student's owned accessories by:
   * 1. Querying redemptions for this user
   * 2. Joining to shop_items where category = 'accessory'
   */
  async function loadAccessories(userId: string) {
    // Fetch redemption item IDs for this user
    const { data: redemptions, error: redemptionError } = await supabase
      .from('redemptions')
      .select('item_id')
      .eq('user_id', userId)

    if (redemptionError) {
      console.error('Error fetching redemptions:', redemptionError)
      return
    }

    if (!redemptions || redemptions.length === 0) {
      setAccessories([])
      return
    }

    const itemIds = redemptions.map((r: { item_id: string }) => r.item_id)

    // Fetch shop items that are accessories
    const { data: shopItems, error: shopError } = await supabase
      .from('shop_items')
      .select('id, title, image_url')
      .in('id', itemIds)
      .eq('category', 'accessory')

    if (shopError) {
      console.error('Error fetching accessory shop items:', shopError)
      return
    }

    setAccessories((shopItems ?? []) as AccessoryItem[])
  }

  async function loadBalance(userId: string) {
    const { data: walletData } = await supabase
      .from('student_wallets')
      .select('spendable_balance')
      .eq('user_id', userId)
      .single()
    setBalance(walletData?.spendable_balance ?? 0)
  }

  async function loadPendingFeedings(userId: string) {
    const { data } = await supabase
      .from('pet_feedings')
      .select('id, food_xp, item_title, created_at')
      .eq('user_id', userId)
      .is('fed_at', null)
      .order('created_at', { ascending: true })
    setPendingFeedings((data ?? []) as PendingFeeding[])
  }

  async function handleFeed(feedingId: string) {
    if (!pet || feeding) return
    setFeeding(feedingId)

    const stageBefore = pet.evolution_stage

    try {
      const res = await fetch('/api/pet/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeding_id: feedingId }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error('Feed error:', data.error)
        return
      }

      const { xp_gained, new_xp, new_stage } = data

      // Update pet state immediately
      setPet(prev => prev ? {
        ...prev,
        xp: new_xp,
        evolution_stage: new_stage,
      } : prev)

      // Remove from pending list
      setPendingFeedings(prev => prev.filter(f => f.id !== feedingId))

      // Show +XP label
      setXpGainedLabel(xp_gained)
      setXpLabelVisible(true)

      // Happy animation
      setPetAnimation('happy')

      // If evolved, trigger sparkle
      if (new_stage !== stageBefore && stageBefore !== 'egg') {
        setEvolvedFrom(stageBefore)
        setSparkleActive(true)
        sparkleTimerRef.current = setTimeout(() => {
          setSparkleActive(false)
          setEvolvedFrom(null)
        }, 1200)
      }

      // Fade out XP label after 2.5s
      xpLabelTimerRef.current = setTimeout(() => {
        setXpLabelVisible(false)
      }, 2500)

      // Revert to idle after happy animation
      animationTimerRef.current = setTimeout(() => {
        setPetAnimation('idle')
      }, 700)

    } finally {
      setFeeding(null)
    }
  }

  async function handleSpeciesSelect(species: Species) {
    if (!pet) return
    setSpeciesError(null)

    const { data: updatedPet, error } = await supabase
      .from('student_pets')
      .update({
        species,
        evolution_stage: 'baby',
      })
      .eq('id', pet.id)
      .select('*')
      .single()

    if (error) {
      console.error('Error selecting species:', error)
      setSpeciesError('Failed to select species. Please try again.')
      return
    }

    // Update local state
    setPet(updatedPet as StudentPet)

    // Trigger sparkle animation for 800ms
    setSparkleActive(true)
    sparkleTimerRef.current = setTimeout(() => {
      setSparkleActive(false)
    }, 800)
  }

  async function handleRestart() {
    if (!pet || restarting) return
    setRestarting(true)
    setRestartError(null)

    const { error } = await supabase
      .from('student_pets')
      .update({
        species: null,
        evolution_stage: 'egg',
        xp: 0,
        equipped_accessories: [],
      })
      .eq('id', pet.id)

    if (error) {
      console.error('Error restarting pet:', error)
      setRestartError('Failed to restart. Please try again.')
      setRestarting(false)
      return
    }

    setPet(prev => prev ? {
      ...prev,
      species: null,
      evolution_stage: 'egg',
      xp: 0,
      equipped_accessories: [],
    } : prev)
    setShowRestartConfirm(false)
    setRestarting(false)
  }

  async function handleEquip(accessoryId: string) {
    if (!pet) return
    setAccessoryError(null)

    // Optimistic update: immediately add to local state
    const previousEquipped = pet.equipped_accessories
    const newEquipped = equipAccessory(accessoryId, previousEquipped)
    setPet({ ...pet, equipped_accessories: newEquipped })

    // Persist to Supabase
    const { error } = await supabase
      .from('student_pets')
      .update({ equipped_accessories: newEquipped })
      .eq('id', pet.id)

    if (error) {
      console.error('Error equipping accessory:', error)
      // Revert optimistic update
      setPet({ ...pet, equipped_accessories: previousEquipped })
      setAccessoryError('Failed to equip accessory. Please try again.')
    }
  }

  async function handleUnequip(accessoryId: string) {
    if (!pet) return
    setAccessoryError(null)

    // Optimistic update: immediately remove from local state
    const previousEquipped = pet.equipped_accessories
    const newEquipped = unequipAccessory(accessoryId, previousEquipped)
    setPet({ ...pet, equipped_accessories: newEquipped })

    // Persist to Supabase
    const { error } = await supabase
      .from('student_pets')
      .update({ equipped_accessories: newEquipped })
      .eq('id', pet.id)

    if (error) {
      console.error('Error unequipping accessory:', error)
      // Revert optimistic update
      setPet({ ...pet, equipped_accessories: previousEquipped })
      setAccessoryError('Failed to unequip accessory. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🥚</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const isEgg = pet?.evolution_stage === 'egg'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Restart confirmation modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="text-5xl mb-4">🥚</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Start Over?</h2>
            <p className="text-gray-500 text-sm mb-6">
              This will reset your pet back to an egg. Your XP, species, and equipped accessories will be cleared. This cannot be undone.
            </p>
            {restartError && (
              <p className="text-red-600 text-sm mb-4" role="alert">{restartError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRestartConfirm(false); setRestartError(null) }}
                className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestart}
                disabled={restarting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {restarting ? 'Resetting…' : 'Yes, Start Over'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        {/* Header row: back button + title + restart */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">My Pet 🐾</h1>
          <button
            onClick={() => setShowRestartConfirm(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
            title="Reset pet to egg"
          >
            🔄 Restart
          </button>
        </div>

        {/* Balance + Shop link — visible regardless of evolution stage */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Balance</p>
              <p className="text-2xl font-bold text-primary-600">{balance} <span className="text-sm font-normal text-gray-400">pts</span></p>
            </div>
          </div>
          <Link
            href="/shop"
            className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors"
          >
            Go to Shop 🛍️
          </Link>
        </div>

        {isEgg ? (
          /* ── Egg stage: show egg SVG + species selector ── */
          <>
            <div className="flex justify-center mb-8">
              <div className="relative inline-flex items-center justify-center">
                <EggSvg size={200} />
                <EvolutionSparkle active={sparkleActive} />
              </div>
            </div>

            <div className="mt-4">
              {speciesError && (
                <p className="text-center text-red-600 text-sm mb-4" role="alert">
                  {speciesError}
                </p>
              )}
              {pendingFeedings.length > 0 && (
                <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-orange-700 text-sm font-semibold">🍖 {pendingFeedings.length} food item{pendingFeedings.length !== 1 ? 's' : ''} waiting — hatch your pet first!</p>
                </div>
              )}
              <SpeciesSelector onSelect={handleSpeciesSelect} />
            </div>
          </>
        ) : (
          /* ── Non-egg stage: BackgroundScene + PetSvg overlay + XpBar + Accessories ── */
          <>
            {/* Pet scene card */}
            <div className="rounded-2xl overflow-hidden shadow-lg mb-4">
              {/* Background + pet overlay container */}
              <div className="relative w-full" style={{ height: '300px' }}>
                {/* Background fills the container */}
                <BackgroundScene
                  stage={pet?.evolution_stage ?? 'baby'}
                  className="absolute inset-0 w-full h-full"
                />

                {/* PetSvg centered on top of the background */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <PetSvg
                      species={pet?.species ?? 'dragon'}
                      stage={
                        (pet?.evolution_stage as Exclude<EvolutionStage, 'egg'>) ?? 'baby'
                      }
                      animation={petAnimation}
                      size={160}
                    />
                    <EvolutionSparkle active={sparkleActive} />

                    {/* +N XP transient label shown after a feeding */}
                    {xpGainedLabel !== null && (
                      <div
                        aria-live="polite"
                        style={{
                          position: 'absolute',
                          top: '-2rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          opacity: xpLabelVisible ? 1 : 0,
                          transition: 'opacity 0.5s ease-out',
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          color: '#16a34a',
                          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      >
                        +{xpGainedLabel} XP
                      </div>
                    )}
                  </div>
                </div>

                {/* Equipped accessories as overlays */}
                {pet && pet.equipped_accessories.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {pet.equipped_accessories.map((accessoryId, idx) => {
                      const item = accessories.find((a) => a.id === accessoryId)
                      if (!item) return null

                      // Stagger multiple accessories slightly so they don't all stack
                      const offsetX = (idx - Math.floor(pet.equipped_accessories.length / 2)) * 28

                      if (item.image_url) {
                        return (
                          <img
                            key={accessoryId}
                            src={item.image_url}
                            alt={item.title}
                            className="absolute w-14 h-14 object-contain"
                            style={{
                              top: '18%',
                              left: `calc(50% + ${offsetX}px)`,
                              transform: 'translateX(-50%)',
                            }}
                            aria-hidden="true"
                          />
                        )
                      }

                      // Fallback: extract the leading emoji from the title and show it as a badge
                      const emojiMatch = item.title.match(/^\p{Emoji}/u)
                      const emoji = emojiMatch ? emojiMatch[0] : '🎀'

                      return (
                        <div
                          key={accessoryId}
                          aria-label={item.title}
                          title={item.title}
                          style={{
                            position: 'absolute',
                            top: '14%',
                            left: `calc(50% + ${offsetX}px)`,
                            transform: 'translateX(-50%)',
                            fontSize: '2rem',
                            lineHeight: 1,
                            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))',
                          }}
                        >
                          {emoji}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Evolution stage label */}
              <div className="bg-white px-4 py-2 border-t border-gray-100">
                <p className="text-center text-sm font-semibold text-gray-700">
                  {getStageLabel(pet?.species ?? null, pet?.evolution_stage ?? 'baby')}
                </p>
              </div>
            </div>

            {/* XP bar */}
            <div className="mb-6">
              <XpBar
                xp={pet?.xp ?? 0}
                stage={pet?.evolution_stage ?? 'baby'}
              />
            </div>

            {/* Pending food — feed your pet! */}
            {pendingFeedings.length > 0 && (
              <div className="mb-6 bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <h2 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2">
                  <span>🍖</span>
                  <span>Feed your pet! ({pendingFeedings.length} item{pendingFeedings.length !== 1 ? 's' : ''} waiting)</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {pendingFeedings.map((f) => (
                    <div key={f.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 shadow-sm border border-orange-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{f.item_title}</p>
                        <p className="text-xs text-orange-600 font-medium">+{f.food_xp} XP</p>
                      </div>
                      <button
                        onClick={() => handleFeed(f.id)}
                        disabled={feeding === f.id}
                        className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors active:scale-95"
                      >
                        {feeding === f.id ? '🍽️ Feeding…' : '🍖 Feed!'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evolution notification */}
            {evolvedFrom && (
              <div className="mb-4 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 text-center animate-pulse">
                <p className="text-purple-700 font-bold text-sm">✨ Your pet evolved! ✨</p>
              </div>
            )}

            {/* Accessory inventory */}
            <section aria-labelledby="accessories-heading">
              <h2
                id="accessories-heading"
                className="text-lg font-semibold text-gray-800 mb-3"
              >
                Accessories
              </h2>
              {accessoryError && (
                <p className="text-sm text-red-600 mb-3" role="alert">
                  {accessoryError}
                </p>
              )}
              <AccessoryInventory
                accessories={accessories}
                equippedIds={pet?.equipped_accessories ?? []}
                onEquip={handleEquip}
                onUnequip={handleUnequip}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
