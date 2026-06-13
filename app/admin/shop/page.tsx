'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'
import {
  validateShopItemForm,
  buildShopItemInsert,
} from '@/lib/utils/shop'
import type {
  ShopItem,
  ShopItemForm,
  RedemptionWithDetails,
  StudentBalance,
  BlindboxSet,
} from '@/lib/types/shop'

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Admin Shop Page
//
// Allows teachers to create/edit/deactivate shop items, view all redemptions,
// and see each student's current spendable balance.
//
// NOTE: Student total_score is NEVER modified here. Spendable balance is
// computed as SUM(locked submissions) - SUM(redemptions.points_spent).
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FORM: ShopItemForm = {
  title: '',
  description: '',
  details: '',
  cost: '',
  image_url: '',
  quantity: '',
  category: 'other',
  commodity_type: 'standard',
  food_xp: '',
  target_species: '',
  draws_per_redemption: '1',
}

export default function AdminShopPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ShopItem[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionWithDetails[]>([])
  const [studentBalances, setStudentBalances] = useState<StudentBalance[]>([])
  const [form, setForm] = useState<ShopItemForm>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refunding, setRefunding] = useState<string | null>(null)
  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingBlindbox, setUploadingBlindbox] = useState(false)
  // Set-based blind box state
  // Each set: { id (temp or real), name, quantity (physical copies), existingImages, newFiles, newPreviews, removedImageIds }
  type SetDraft = {
    tempId: string          // client-only id for new sets; real UUID for existing
    dbId: string | null     // null = not yet saved to DB
    name: string
    quantity: string        // physical copies of this set ('' = unlimited for digital)
    existingImages: Array<{ id: string; image_url: string }>
    newFiles: File[]
    newPreviews: string[]
    removedImageIds: string[]
  }
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>([])

  const [physicalBlindboxInventory, setPhysicalBlindboxInventory] = useState<Record<string, { total: number; remaining: number }>>({})

  const loadData = useCallback(async () => {
    // Fetch all shop items (active + inactive) — hide pet categories on main
    const { data: shopItems, error: itemsError } = await supabase
      .from('shop_items')
      .select('*')
      .not('category', 'in', '("food","accessory","pet")')
      .order('created_at', { ascending: false })

    if (itemsError) {
      setError('Failed to load shop items')
      return
    }
    setItems(shopItems ?? [])

    // Fetch inventory for physical_blindbox items (set quantities)
    const physicalBoxIds = (shopItems ?? [])
      .filter((i: any) => i.commodity_type === 'physical_blindbox')
      .map((i: any) => i.id)

    if (physicalBoxIds.length > 0) {
      const { data: sets } = await supabase
        .from('blindbox_sets')
        .select('item_id, quantity')
        .in('item_id', physicalBoxIds)

      const inv: Record<string, { total: number; remaining: number }> = {}
      for (const s of sets ?? []) {
        if (!inv[s.item_id]) inv[s.item_id] = { total: 0, remaining: 0 }
        const qty = s.quantity ?? 0
        inv[s.item_id].total += qty
        if (qty > 0) inv[s.item_id].remaining += qty
      }
      setPhysicalBlindboxInventory(inv)
    }

    // Fetch all redemptions with student name, item title, and commodity type
    const { data: redemptionData } = await supabase
      .from('redemptions')
      .select('*, profiles(first_name, last_name), shop_items(title, commodity_type)')
      .order('redeemed_at', { ascending: false })

    // Fetch all claimed blind box images (teacher can see all via RLS)
    // For set-based blindboxes: fetch all images in each claimed set
    const claimedImageMap: Record<string, string[]> = {}
    try {
      const [claimedImagesResult, blindboxClaimsResult] = await Promise.all([
        supabase
          .from('blindbox_images')
          .select('item_id, claimed_by, image_url')
          .eq('is_claimed', true),
        supabase
          .from('blindbox_claims')
          .select('item_id, student_id, set_id, blindbox_sets(id, blindbox_images(image_url, sort_order))')
          .order('claimed_at', { ascending: false }),
      ])

      // From old blindbox_images.claimed_by (single image)
      for (const img of claimedImagesResult.data ?? []) {
        if (img.claimed_by && img.image_url) {
          const key = `${img.item_id}:${img.claimed_by}`
          if (!claimedImageMap[key]) claimedImageMap[key] = []
          if (!claimedImageMap[key].includes(img.image_url)) {
            claimedImageMap[key].push(img.image_url)
          }
        }
      }

      // From new blindbox_claims with set images
      for (const claim of blindboxClaimsResult.data ?? []) {
        const key = `${claim.item_id}:${claim.student_id}`
        if (!claimedImageMap[key]) claimedImageMap[key] = []

        if (claim.set_id && (claim as any).blindbox_sets?.blindbox_images) {
          const setImages = [...((claim as any).blindbox_sets.blindbox_images)]
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((img: any) => img.image_url)
            .filter(Boolean)
          for (const url of setImages) {
            if (!claimedImageMap[key].includes(url)) claimedImageMap[key].push(url)
          }
        } else {
          const url = (claim as any).blindbox_images?.image_url
          if (url && !claimedImageMap[key].includes(url)) claimedImageMap[key].push(url)
        }
      }
    } catch (e) {
      console.warn('[admin/shop] Failed to load blindbox claims:', e)
    }

    setRedemptions(
      (redemptionData ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        item_id: r.item_id,
        points_spent: r.points_spent,
        redeemed_at: r.redeemed_at,
        student_name:
          [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(' ') ||
          'Unknown student',
        item_title: r.shop_items?.title ?? 'Unknown item',
        item_commodity_type: r.shop_items?.commodity_type ?? 'standard',
        blindbox_image_url: (r.shop_items?.commodity_type === 'blindbox' || r.shop_items?.commodity_type === 'physical_blindbox')
          ? (claimedImageMap[`${r.item_id}:${r.user_id}`]?.[0] ?? null)
          : null,
        blindbox_image_urls: (r.shop_items?.commodity_type === 'blindbox' || r.shop_items?.commodity_type === 'physical_blindbox')
          ? (claimedImageMap[`${r.item_id}:${r.user_id}`] ?? [])
          : [],
        refunded_at: r.refunded_at ?? null,
      }))
    )

    // Fetch all students and their balances from student_wallets (single query)
    // NOTE: do NOT filter by class_id — students may only have class-scoped roles
    const { data: studentRoles } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .eq('roles.name', 'student')

    const studentIds = [...new Set((studentRoles ?? []).map((r: any) => r.user_id))]

    if (studentIds.length > 0) {
      const [profilesResult, walletsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', studentIds),
        supabase
          .from('student_wallets')
          .select('user_id, total_earned, total_spent, spendable_balance')
          .in('user_id', studentIds),
      ])

      const profiles = profilesResult.data ?? []
      const walletMap: Record<string, { total_earned: number; total_spent: number; spendable_balance: number }> = {}
      for (const w of walletsResult.data ?? []) {
        walletMap[w.user_id] = w
      }

      const balances: StudentBalance[] = profiles.map((p: any) => {
        const wallet = walletMap[p.id]
        return {
          user_id: p.id,
          student_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
          total_earned: wallet?.total_earned ?? 0,
          total_spent: wallet?.total_spent ?? 0,
          spendable_balance: wallet?.spendable_balance ?? 0,
        }
      })

      setStudentBalances(balances.sort((a, b) => b.spendable_balance - a.spendable_balance))
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Verify teacher role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', user.id)
        .is('class_id', null)

      if (userRoles && userRoles.length > 0) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('name')
          .in('id', userRoles.map((r: any) => r.role_id))

        const isTeacher = roleData?.some(
          (r: any) => r.name === 'teacher' || r.name === 'administrator'
        )
        if (!isTeacher) {
          router.push('/login')
          return
        }
      } else {
        router.push('/login')
        return
      }

      await loadData()
      setLoading(false)
    }
    init()
  }, [router, supabase, loadData])

  function handleFormChange(field: keyof ShopItemForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function handleCategoryChange(value: string) {
    setForm((prev) => ({
      ...prev,
      category: value,
      // Clear food_xp when switching away from food
      food_xp: value === 'food' ? prev.food_xp : '',
      // Clear target_species when switching away from pet
      target_species: value === 'pet' ? prev.target_species : '',
    }))
    setFormErrors((prev) => ({ ...prev, category: '', food_xp: '', target_species: '' }))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, image_url: 'Image must be less than 5MB' }))
      return
    }
    if (!file.type.startsWith('image/')) {
      setFormErrors((prev) => ({ ...prev, image_url: 'File must be an image' }))
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setFormErrors((prev) => ({ ...prev, image_url: '' }))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setForm((prev) => ({ ...prev, image_url: '' }))
  }

  // ── Set-based blind box helpers ──────────────────────────────────────────

  function addSet() {
    setSetDrafts(prev => [...prev, {
      tempId: `new-${Date.now()}-${Math.random()}`,
      dbId: null,
      name: `Set ${prev.length + 1}`,
      quantity: form.commodity_type === 'physical_blindbox' ? '0' : '',
      existingImages: [],
      newFiles: [],
      newPreviews: [],
      removedImageIds: [],
    }])
  }

  function removeSet(tempId: string) {
    setSetDrafts(prev => prev.filter(s => s.tempId !== tempId))
  }

  function updateSetName(tempId: string, name: string) {
    setSetDrafts(prev => prev.map(s => s.tempId === tempId ? { ...s, name } : s))
  }

  function updateSetQuantity(tempId: string, quantity: string) {
    setSetDrafts(prev => prev.map(s => s.tempId === tempId ? { ...s, quantity } : s))
  }

  function addImagesToSet(tempId: string, files: File[]) {
    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024)
    const previews = valid.map(f => URL.createObjectURL(f))
    setSetDrafts(prev => prev.map(s =>
      s.tempId === tempId
        ? { ...s, newFiles: [...s.newFiles, ...valid], newPreviews: [...s.newPreviews, ...previews] }
        : s
    ))
  }

  function removeNewImageFromSet(tempId: string, index: number) {
    setSetDrafts(prev => prev.map(s => {
      if (s.tempId !== tempId) return s
      return {
        ...s,
        newFiles: s.newFiles.filter((_, i) => i !== index),
        newPreviews: s.newPreviews.filter((_, i) => i !== index),
      }
    }))
  }

  function toggleRemoveExistingImage(tempId: string, imageId: string) {
    setSetDrafts(prev => prev.map(s => {
      if (s.tempId !== tempId) return s
      const already = s.removedImageIds.includes(imageId)
      return {
        ...s,
        removedImageIds: already
          ? s.removedImageIds.filter(id => id !== imageId)
          : [...s.removedImageIds, imageId],
      }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validateShopItemForm(form)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      // Show a summary error so it's visible
      const firstError = Object.values(validation.errors)[0]
      setError('Please fix the form errors: ' + firstError)
      return
    }
    setError(null)

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Upload image to Supabase Storage if a new file was selected
      let finalImageUrl = form.image_url.trim() || null
      if (imageFile) {
        setUploadingImage(true)
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('shop-images')
          .upload(fileName, imageFile)
        setUploadingImage(false)
        if (uploadError) {
          setError('Failed to upload image: ' + uploadError.message)
          setSubmitting(false)
          return
        }
        const { data: { publicUrl } } = supabase.storage
          .from('shop-images')
          .getPublicUrl(fileName)
        finalImageUrl = publicUrl
      }

      if (editingId) {
        // For physical_blindbox, auto-compute quantity from set quantities
        const computedQuantity = form.commodity_type === 'physical_blindbox'
          ? (setDrafts.some(s => s.quantity !== '')
              ? setDrafts.reduce((sum, s) => sum + (s.quantity !== '' ? parseInt(s.quantity, 10) || 0 : 0), 0)
              : null)
          : (form.quantity.trim() !== '' ? parseInt(form.quantity, 10) : null)

        // Update existing item
        const { error: updateError } = await supabase
          .from('shop_items')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            details: form.details.trim() || null,
            cost: parseInt(form.cost, 10),
            image_url: finalImageUrl,
            quantity: computedQuantity,
            commodity_type: form.commodity_type || 'standard',
            category: form.category || 'other',
            food_xp: form.category === 'food' ? parseInt(form.food_xp, 10) : null,
            target_species: form.category === 'pet' ? form.target_species || null : null,
            draws_per_redemption: Math.max(1, Math.min(20, parseInt(form.draws_per_redemption || '1', 10) || 1)),
          })
          .eq('id', editingId)

        if (updateError) {
          setError('Failed to update item')
          return
        }

        // Handle set-based blindbox changes when editing
        if (form.commodity_type === 'blindbox' || form.commodity_type === 'physical_blindbox') {
          setUploadingBlindbox(true)
          for (const draft of setDrafts) {
            // Delete removed existing images
            if (draft.removedImageIds.length > 0) {
              await supabase.from('blindbox_images').delete().in('id', draft.removedImageIds)
            }

            let setDbId = draft.dbId
            if (!setDbId) {
              // Create new set in DB
              const { data: newSet, error: setErr } = await supabase
                .from('blindbox_sets')
                .insert({
                  item_id: editingId,
                  name: draft.name,
                  sort_order: setDrafts.indexOf(draft),
                  quantity: form.commodity_type === 'physical_blindbox'
                    ? parseInt(draft.quantity || '0', 10) : null,
                })
                .select('id')
                .single()
              if (setErr) {
                setError('Failed to create set "' + draft.name + '": ' + setErr.message + '. Have you run supabase/add-blindbox-sets.sql?')
                setUploadingBlindbox(false)
                return
              }
              setDbId = newSet?.id ?? null
            } else {
              // Update set name and quantity
              await supabase.from('blindbox_sets').update({
                name: draft.name,
                quantity: form.commodity_type === 'physical_blindbox'
                  ? parseInt(draft.quantity || '0', 10) : null,
              }).eq('id', setDbId)
            }

            if (!setDbId) continue

            // Upload new images for this set
            const existingCount = draft.existingImages.filter(img => !draft.removedImageIds.includes(img.id)).length
            for (let i = 0; i < draft.newFiles.length; i++) {
              const file = draft.newFiles[i]
              const fileExt = file.name.split('.').pop()
              const fileName = `blindbox/${editingId}/${setDbId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
              const { error: uploadErr } = await supabase.storage.from('shop-images').upload(fileName, file)
              if (uploadErr) {
                setError('Failed to upload image to set "' + draft.name + '": ' + uploadErr.message)
                setUploadingBlindbox(false)
                return
              }
              const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(fileName)
              const { error: imgInsertErr } = await supabase.from('blindbox_images').insert({
                item_id: editingId,
                set_id: setDbId,
                image_url: publicUrl,
                sort_order: existingCount + i,
              })
              if (imgInsertErr) {
                setError('Failed to save image record: ' + imgInsertErr.message)
                setUploadingBlindbox(false)
                return
              }
            }
          }
          setUploadingBlindbox(false)
        }
      } else {
        // Create new item — override image_url with uploaded URL
        // For physical_blindbox, auto-compute quantity from set quantities
        const newItemQuantity = form.commodity_type === 'physical_blindbox'
          ? (setDrafts.some(s => s.quantity !== '')
              ? setDrafts.reduce((sum, s) => sum + (s.quantity !== '' ? parseInt(s.quantity, 10) || 0 : 0), 0)
              : null)
          : undefined  // let buildShopItemInsert handle it from form.quantity

        const payload = {
          ...buildShopItemInsert(form, user.id),
          image_url: finalImageUrl,
          details: form.details.trim() || null,
          commodity_type: form.commodity_type || 'standard',
          ...(newItemQuantity !== undefined ? { quantity: newItemQuantity } : {}),
        }
        const { data: newItem, error: insertError } = await supabase
          .from('shop_items')
          .insert(payload)
          .select('id')
          .single()
        if (insertError || !newItem) {
          setError('Failed to create item')
          return
        }

        // Upload set-based blindbox images for new item
        if ((form.commodity_type === 'blindbox' || form.commodity_type === 'physical_blindbox') && setDrafts.length > 0) {
          setUploadingBlindbox(true)
          for (let si = 0; si < setDrafts.length; si++) {
            const draft = setDrafts[si]

            // Create the set in DB (always, even if no images yet)
            const { data: newSet, error: setErr } = await supabase
              .from('blindbox_sets')
              .insert({
                item_id: newItem.id,
                name: draft.name,
                sort_order: si,
                quantity: form.commodity_type === 'physical_blindbox'
                  ? parseInt(draft.quantity || '0', 10) : null,
              })
              .select('id')
              .single()
            if (setErr || !newSet?.id) continue
            const setDbId = newSet.id

            // Upload images for this set
            for (let i = 0; i < draft.newFiles.length; i++) {
              const file = draft.newFiles[i]
              const fileExt = file.name.split('.').pop()
              const fileName = `blindbox/${newItem.id}/${setDbId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
              const { error: uploadErr } = await supabase.storage.from('shop-images').upload(fileName, file)
              if (!uploadErr) {
                const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(fileName)
                await supabase.from('blindbox_images').insert({
                  item_id: newItem.id,
                  set_id: setDbId,
                  image_url: publicUrl,
                  sort_order: i,
                })
              }
            }
          }
          setUploadingBlindbox(false)
        }
      }

      setForm(EMPTY_FORM)
      setEditingId(null)
      setImageFile(null)
      setImagePreview(null)
      setSetDrafts([])
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(item: ShopItem) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description ?? '',
      details: (item as any).details ?? '',
      cost: String(item.cost),
      image_url: item.image_url ?? '',
      quantity: item.quantity !== null ? String(item.quantity) : '',
      category: item.category ?? 'other',
      commodity_type: item.commodity_type ?? 'standard',
      food_xp: item.food_xp !== null ? String(item.food_xp) : '',
      target_species: item.target_species ?? '',
      draws_per_redemption: String(item.draws_per_redemption ?? 1),
    })
    setImageFile(null)
    setImagePreview(item.image_url ?? null)
    setSetDrafts([])

    // Fetch existing blindbox sets and their images if applicable
    if (item.commodity_type === 'blindbox' || item.commodity_type === 'physical_blindbox') {
      // Fetch sets first, then images separately (nested select doesn't work for this FK direction)
      supabase
        .from('blindbox_sets')
        .select('id, name, sort_order, quantity')
        .eq('item_id', item.id)
        .order('sort_order', { ascending: true })
        .then(async ({ data: sets }) => {
          if (sets && sets.length > 0) {
            // Fetch all images for this item that belong to a set
            const { data: allImages } = await supabase
              .from('blindbox_images')
              .select('id, image_url, sort_order, set_id')
              .eq('item_id', item.id)
              .not('set_id', 'is', null)
              .order('sort_order', { ascending: true })

            const imagesBySet: Record<string, Array<{ id: string; image_url: string }>> = {}
            for (const img of allImages ?? []) {
              if (!imagesBySet[img.set_id]) imagesBySet[img.set_id] = []
              imagesBySet[img.set_id].push({ id: img.id, image_url: img.image_url })
            }

            setSetDrafts(sets.map((s: any) => ({
              tempId: s.id,
              dbId: s.id,
              name: s.name,
              quantity: s.quantity !== null && s.quantity !== undefined ? String(s.quantity) : '',
              existingImages: imagesBySet[s.id] ?? [],
              newFiles: [],
              newPreviews: [],
              removedImageIds: [],
            })))
          } else {
            // Legacy: item has images but no sets — show one default set
            supabase
              .from('blindbox_images')
              .select('id, image_url')
              .eq('item_id', item.id)
              .is('set_id', null)
              .order('sort_order', { ascending: true })
              .then(({ data: imgs }) => {
                if (imgs && imgs.length > 0) {
                  setSetDrafts([{
                    tempId: 'legacy',
                    dbId: null,
                    name: 'Set 1',
                    quantity: '',
                    existingImages: imgs,
                    newFiles: [],
                    newPreviews: [],
                    removedImageIds: [],
                  }])
                }
              })
          }
        })
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeactivate(itemId: string) {
    const { error: deactivateError } = await supabase
      .from('shop_items')
      .update({ is_active: false })
      .eq('id', itemId)

    if (deactivateError) {
      setError('Failed to deactivate item')
      return
    }
    await loadData()
  }

  async function handleReactivate(itemId: string) {
    await supabase.from('shop_items').update({ is_active: true }).eq('id', itemId)
    await loadData()
  }

  async function handleDelete(itemId: string) {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return
    const { error: deleteError } = await supabase
      .from('shop_items')
      .delete()
      .eq('id', itemId)
    if (deleteError) {
      setError('Failed to delete item: ' + deleteError.message)
      return
    }
    await loadData()
  }

  async function handleRefund(redemptionId: string, pointsSpent: number, studentName: string) {
    if (!confirm(`Refund ${pointsSpent} pts to ${studentName}? This will delete the redemption record and restore their points.`)) return
    setRefunding(redemptionId)
    setError(null)
    try {
      const res = await fetch('/api/shop/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemption_id: redemptionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError('Refund failed: ' + (data.error || 'Unknown error'))
        return
      }
      await loadData()
    } finally {
      setRefunding(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🛍️</div>
          <p className="text-gray-600">Loading shop admin...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-3">
          <HomeButton noSlash />
          <h1 className="text-xl font-bold text-gray-900">Shop Admin 🛍️</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-10">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ── Create / Edit Form ── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Edit Item' : 'Create New Item'}
          </h2>
          {editingId && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              Editing: <strong>{items.find(i => i.id === editingId)?.title}</strong>
            </div>
          )}
          <Card>
            <Card.Body>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    maxLength={100}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="e.g. Free Period"
                  />
                  {formErrors.title && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="Optional short description"
                  />
                  {formErrors.description && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Details (collapsible — shown to students)
                  </label>
                  <textarea
                    value={form.details}
                    onChange={(e) => handleFormChange('details', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="What students can expect, terms, how to use, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commodity Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['standard', 'blindbox', 'physical', 'physical_blindbox'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleFormChange('commodity_type', type)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${
                          form.commodity_type === type
                            ? type === 'blindbox' ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : type === 'physical' ? 'border-amber-500 bg-amber-50 text-amber-700'
                              : type === 'physical_blindbox' ? 'border-rose-500 bg-rose-50 text-rose-700'
                              : 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {type === 'standard' ? '🎁 Standard'
                          : type === 'blindbox' ? '🎲 Blind Box'
                          : type === 'physical' ? '📦 Physical'
                          : '📦🎲 Physical Box'}
                      </button>
                    ))}
                  </div>
                  {form.commodity_type === 'blindbox' && (
                    <p className="text-xs text-purple-600 mt-1">Students draw one set at a time. Each set is a group of images revealed together. Define sets below.</p>
                  )}
                  {form.commodity_type === 'physical' && (
                    <p className="text-xs text-amber-600 mt-1">You will receive an in-app notification when a student redeems this item.</p>
                  )}
                  {form.commodity_type === 'physical_blindbox' && (
                    <p className="text-xs text-rose-600 mt-1">Student gets a random image from the pool (each claimed once) AND you get notified to ship the physical item.</p>
                  )}
                </div>

                {/* Draws per redemption hidden for set-based boxes — sets define the group size */}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'other', label: '🎁 Other' },
                      ] as const).map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleCategoryChange(value)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-colors ${
                            form.category === value
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {formErrors.category && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.category}</p>
                    )}
                  </div>

                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost (points) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.cost}
                      onChange={(e) => handleFormChange('cost', e.target.value)}
                      min={1}
                      max={10000}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="e.g. 50"
                    />
                    {formErrors.cost && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.cost}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {form.commodity_type === 'physical_blindbox'
                        ? 'Total inventory (auto-computed from sets)'
                        : 'Quantity (blank = unlimited)'}
                    </label>
                    {form.commodity_type === 'physical_blindbox' ? (
                      <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-500">
                        {setDrafts.some(s => s.quantity !== '')
                          ? `${setDrafts.reduce((sum, s) => sum + (s.quantity !== '' ? parseInt(s.quantity, 10) || 0 : 0), 0)} total items`
                          : 'Set per-set quantities below'}                      </div>
                    ) : (
                      <input
                        type="number"
                        value={form.quantity}
                        onChange={(e) => handleFormChange('quantity', e.target.value)}
                        min={1}
                        max={9999}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                        placeholder="Unlimited"
                      />
                    )}
                    {formErrors.quantity && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.quantity}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image (optional)
                  </label>
                  {imagePreview ? (
                    <div className="flex items-start gap-3">
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                        <img
                          src={imagePreview}
                          alt="Item preview"
                          className="w-full h-full object-contain bg-gray-50"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-gray-500">Current image</p>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 w-fit"
                        >
                          Remove
                        </button>
                        <label htmlFor="shop-item-image" className="cursor-pointer px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 w-fit">
                          Replace
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="shop-item-image"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="shop-item-image"
                      />
                      <label htmlFor="shop-item-image" className="cursor-pointer">
                        <div className="text-3xl mb-1">📸</div>
                        <div className="text-sm text-gray-600">Click to upload image (max 5MB)</div>
                      </label>
                    </div>
                  )}
                  {formErrors.image_url && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.image_url}</p>
                  )}
                </div>

                {/* Blind box draw sets */}
                {(form.commodity_type === 'blindbox' || form.commodity_type === 'physical_blindbox') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {form.commodity_type === 'physical_blindbox' ? 'Inventory Sets' : 'Draw Sets'} <span className="text-red-500">*</span>
                        <span className="text-gray-400 font-normal ml-1 text-xs">
                          {form.commodity_type === 'physical_blindbox'
                            ? '— each set is a physical item; set quantity = copies in stock'
                            : '— each draw reveals all images in one randomly selected set'}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={addSet}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        + Add Set
                      </button>
                    </div>

                    {setDrafts.length === 0 && (
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-6 text-center text-sm text-purple-400">
                        No sets yet. Click "Add Set" to create your first draw set.
                      </div>
                    )}

                    <div className="space-y-4">
                      {setDrafts.map((draft, si) => (
                        <div key={draft.tempId} className="border border-purple-200 rounded-xl p-4 bg-purple-50/50">
                          {/* Set header */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-purple-500 font-bold text-sm">#{si + 1}</span>
                            <input
                              type="text"
                              value={draft.name}
                              onChange={e => updateSetName(draft.tempId, e.target.value)}
                              className="flex-1 border border-purple-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                              placeholder="Set name (e.g. Rare Pack, Series A)"
                            />
                            {form.commodity_type === 'physical_blindbox' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <label className="text-xs text-gray-500 whitespace-nowrap">Qty in stock:</label>
                                <input
                                  type="number"
                                  value={draft.quantity}
                                  onChange={e => updateSetQuantity(draft.tempId, e.target.value)}
                                  min={0}
                                  max={9999}
                                  className="w-16 border border-purple-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-center"
                                  placeholder="0"
                                  title="How many physical copies of this set are available"
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeSet(draft.tempId)}
                              className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 shrink-0"
                            >
                              Remove set
                            </button>
                          </div>

                          {/* Existing images */}
                          {draft.existingImages.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-500 mb-1">Saved images:</p>
                              <div className="grid grid-cols-5 gap-1.5">
                                {draft.existingImages.map(img => {
                                  const removed = draft.removedImageIds.includes(img.id)
                                  return (
                                    <div key={img.id} className={`relative aspect-square rounded-lg overflow-hidden border ${removed ? 'border-red-300 opacity-40' : 'border-purple-200'}`}>
                                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                                      {removed ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleRemoveExistingImage(draft.tempId, img.id)}
                                          className="absolute inset-0 flex items-center justify-center bg-red-100/80 text-red-600 text-[10px] font-semibold"
                                        >
                                          Undo
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => toggleRemoveExistingImage(draft.tempId, img.id)}
                                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center hover:bg-red-600"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* New image previews */}
                          {draft.newPreviews.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-500 mb-1">New images to upload:</p>
                              <div className="grid grid-cols-5 gap-1.5">
                                {draft.newPreviews.map((url, i) => (
                                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-purple-300">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => removeNewImageFromSet(draft.tempId, i)}
                                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center hover:bg-red-600"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Add images to this set */}
                          <label
                            htmlFor={`set-images-${draft.tempId}`}
                            className="cursor-pointer flex items-center gap-2 text-xs text-purple-600 hover:text-purple-800 mt-1"
                          >
                            <span className="text-base">🖼️</span>
                            <span>Add images to this set</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              id={`set-images-${draft.tempId}`}
                              className="hidden"
                              onChange={e => {
                                addImagesToSet(draft.tempId, Array.from(e.target.files ?? []))
                                e.target.value = ''
                              }}
                            />
                          </label>

                          <p className="text-[10px] text-purple-400 mt-1">
                            {draft.existingImages.filter(img => !draft.removedImageIds.includes(img.id)).length + draft.newFiles.length} image(s) in this set
                            {form.commodity_type === 'physical_blindbox' && (
                              <span className="ml-2 text-orange-500 font-semibold">
                                · {draft.quantity || '0'} physical {parseInt(draft.quantity || '0', 10) === 1 ? 'copy' : 'copies'} in stock
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting || uploadingImage || uploadingBlindbox}>
                    {uploadingBlindbox ? 'Uploading images…' : uploadingImage ? 'Uploading image…' : submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Item'}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setImageFile(null); setImagePreview(null); setSetDrafts([]) }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Card.Body>
          </Card>
        </section>

        {/* ── Item List ── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Shop Items</h2>
          {items.length === 0 ? (
            <Card>
              <Card.Body>
                <p className="text-center text-gray-500 py-6">No items yet. Create one above.</p>
              </Card.Body>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {items.map((item) => {
                const isBlindbox = item.commodity_type === 'blindbox' || item.commodity_type === 'physical_blindbox'
                const isPhysical = item.commodity_type === 'physical'
                const isPhysicalBlindbox = item.commodity_type === 'physical_blindbox'
                return (
                  <div
                    key={item.id}
                    className={`group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col ${!item.is_active ? 'opacity-50' : ''}`}
                  >
                    {/* Image area */}
                    <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
                      {isBlindbox ? (
                        item.image_url ? (
                          <div className="relative w-full h-full">
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            <div className="absolute bottom-1 right-1 bg-purple-600/80 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                              🎁 Mystery
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
                            <span className="text-7xl select-none">🎁</span>
                          </div>
                        )
                      ) : isPhysical ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <span className="text-4xl mb-1">📦</span>
                              <span className="text-xs font-semibold text-amber-600">Physical Prize</span>
                            </>
                          )}
                        </div>
                      ) : (
                        item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl select-none">🎁</div>
                        )
                      )}
                      {!item.is_active && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Inactive</span>
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-3 flex flex-col flex-1">
                      {/* Commodity badge */}
                      {(isBlindbox || isPhysical) && (
                        <div className="mb-1">
                          {isPhysicalBlindbox ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">📦🎲 Physical Box</span>
                          ) : isBlindbox ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">🎁 Blind Box</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">📦 Physical</span>
                          )}
                        </div>
                      )}
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-0.5 line-clamp-2">{item.title}</h3>
                      {item.description && (
                        <p className="text-gray-500 text-xs line-clamp-2 mb-1">{item.description}</p>
                      )}
                      <div className="mt-auto pt-2 flex items-center justify-between gap-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-primary-600 font-bold text-sm">
                            {item.cost}<span className="text-gray-400 font-normal text-xs ml-0.5">pts</span>
                            {!isPhysicalBlindbox && item.quantity !== null && (
                              <span className="text-gray-400 font-normal text-xs ml-1">· {item.quantity} max</span>
                            )}
                          </span>
                          {isPhysicalBlindbox && physicalBlindboxInventory[item.id] !== undefined && (
                            <div className="flex items-center gap-1">
                              {physicalBlindboxInventory[item.id].remaining === 0 ? (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                  🚫 Sold out
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                  📦 {physicalBlindboxInventory[item.id].remaining} left
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                          >
                            Edit
                          </button>
                          {item.is_active ? (
                            <button
                              onClick={() => handleDeactivate(item.id)}
                              className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Off
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(item.id)}
                              className="text-xs font-semibold px-2 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >
                              On
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            title="Permanently delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Redemption Log ── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">All Redemptions</h2>
          <Card>
            <Card.Body>
              {redemptions.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No redemptions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-4 font-medium">Student</th>
                        <th className="pb-2 pr-4 font-medium">Item</th>
                        <th className="pb-2 pr-4 font-medium">Prize</th>
                        <th className="pb-2 pr-4 font-medium">Points</th>
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {redemptions.map((r) => (
                        <tr key={r.id} className={r.refunded_at ? 'opacity-50' : ''}>
                          <td className="py-2 pr-4 font-medium text-gray-900">
                            {r.student_name}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={r.refunded_at ? 'line-through text-gray-400' : ''}>{r.item_title}</span>
                              {r.refunded_at && (
                                <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Refunded</span>
                              )}
                              {!r.refunded_at && r.item_commodity_type === 'blindbox' && (
                                <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">🎁 Blind Box</span>
                              )}
                              {!r.refunded_at && r.item_commodity_type === 'physical_blindbox' && (
                                <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">📦🎲 Physical Box</span>
                              )}
                              {!r.refunded_at && r.item_commodity_type === 'physical' && (
                                <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">📦 Physical</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            {r.blindbox_image_urls && r.blindbox_image_urls.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {r.blindbox_image_urls.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={url}
                                      alt={`Prize ${i + 1}`}
                                      className="w-10 h-10 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                                      title={`Prize ${i + 1} — click to view`}
                                    />
                                  </a>
                                ))}
                              </div>
                            ) : r.blindbox_image_url ? (
                              <a href={r.blindbox_image_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={r.blindbox_image_url}
                                  alt="Prize"
                                  className="w-10 h-10 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-primary-600 font-semibold">
                            -{r.points_spent}
                          </td>
                          <td className="py-2 pr-4 text-gray-500">
                            {new Date(r.redeemed_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2">
                            {r.refunded_at ? (
                              <span className="text-xs text-gray-400">
                                {new Date(r.refunded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <button
                                disabled={refunding === r.id}
                                onClick={() => handleRefund(r.id, r.points_spent, r.student_name)}
                                className="text-xs font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Refund ${r.points_spent} pts to ${r.student_name}`}
                              >
                                {refunding === r.id ? '…' : 'Refund'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </section>

        {/* ── Student Balances ── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Student Balances</h2>
          <p className="text-sm text-gray-500 mb-4">
            Spendable balance = total earned (never reduced) − total spent on redemptions
          </p>
          <Card>
            <Card.Body>
              {studentBalances.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No students found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-4 font-medium">Student</th>
                        <th className="pb-2 pr-4 font-medium">Total Earned</th>
                        <th className="pb-2 pr-4 font-medium">Total Spent</th>
                        <th className="pb-2 font-medium">Spendable Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {studentBalances.map((s) => (
                        <tr key={s.user_id}>
                          <td className="py-2 pr-4 font-medium text-gray-900">
                            {s.student_name}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{s.total_earned}</td>
                          <td className="py-2 pr-4 text-gray-700">{s.total_spent}</td>
                          <td className="py-2 font-bold text-primary-600">
                            {s.spendable_balance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </section>
      </main>
    </div>
  )
}
