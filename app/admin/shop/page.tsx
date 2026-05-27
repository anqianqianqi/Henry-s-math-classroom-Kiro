'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  validateShopItemForm,
  buildShopItemInsert,
  computeSpendableBalance,
} from '@/lib/utils/shop'
import type {
  ShopItem,
  ShopItemForm,
  RedemptionWithDetails,
  StudentBalance,
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
  cost: '',
  image_url: '',
  quantity: '',
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
  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const loadData = useCallback(async () => {
    // Fetch all shop items (active + inactive)
    const { data: shopItems, error: itemsError } = await supabase
      .from('shop_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (itemsError) {
      setError('Failed to load shop items')
      return
    }
    setItems(shopItems ?? [])

    // Fetch all redemptions with student name and item title
    const { data: redemptionData } = await supabase
      .from('redemptions')
      .select('*, profiles(first_name, last_name), shop_items(title)')
      .order('redeemed_at', { ascending: false })

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
      }))
    )

    // Fetch all students and compute their spendable balances
    const { data: studentRoles } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .eq('roles.name', 'student')
      .is('class_id', null)

    const studentIds = [...new Set((studentRoles ?? []).map((r: any) => r.user_id))]

    if (studentIds.length > 0) {
      const [profilesResult, submissionsResult, spentResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', studentIds),
        supabase
          .from('challenge_submissions')
          .select('user_id, points')
          .in('user_id', studentIds)
          .eq('is_locked', true),
        supabase
          .from('redemptions')
          .select('user_id, points_spent')
          .in('user_id', studentIds),
      ])

      const profiles = profilesResult.data ?? []
      const submissions = submissionsResult.data ?? []
      const spent = spentResult.data ?? []

      const balances: StudentBalance[] = profiles.map((p: any) => {
        const earned = (submissions as any[])
          .filter((s) => s.user_id === p.id)
          .map((s) => s.points ?? 0)
        const spentPoints = (spent as any[])
          .filter((s) => s.user_id === p.id)
          .map((s) => s.points_spent ?? 0)
        const totalEarned = earned.reduce((a: number, b: number) => a + b, 0)
        const totalSpent = spentPoints.reduce((a: number, b: number) => a + b, 0)
        return {
          user_id: p.id,
          student_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
          total_earned: totalEarned,
          total_spent: totalSpent,
          spendable_balance: computeSpendableBalance(earned, spentPoints),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validateShopItemForm(form)
    if (!validation.valid) {
      setFormErrors(validation.errors)
      return
    }

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
        // Update existing item
        const { error: updateError } = await supabase
          .from('shop_items')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            cost: parseInt(form.cost, 10),
            image_url: finalImageUrl,
            quantity: form.quantity.trim() !== '' ? parseInt(form.quantity, 10) : null,
          })
          .eq('id', editingId)

        if (updateError) {
          setError('Failed to update item')
          return
        }
      } else {
        // Create new item — override image_url with uploaded URL
        const payload = {
          ...buildShopItemInsert(form, user.id),
          image_url: finalImageUrl,
        }
        const { error: insertError } = await supabase.from('shop_items').insert(payload)
        if (insertError) {
          setError('Failed to create item')
          return
        }
      }

      setForm(EMPTY_FORM)
      setEditingId(null)
      setImageFile(null)
      setImagePreview(null)
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
      cost: String(item.cost),
      image_url: item.image_url ?? '',
      quantity: item.quantity !== null ? String(item.quantity) : '',
    })
    // Show existing image as preview (no file selected yet)
    setImageFile(null)
    setImagePreview(item.image_url ?? null)
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
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Dashboard
          </button>
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
            {editingId ? 'Edit Item' : 'Create New Item'}
          </h2>
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
                    placeholder="Optional description"
                  />
                  {formErrors.description && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>
                  )}
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
                      Quantity (blank = unlimited)
                    </label>
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={(e) => handleFormChange('quantity', e.target.value)}
                      min={1}
                      max={9999}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      placeholder="Unlimited"
                    />
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
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Item preview"
                        className="w-full h-40 object-cover rounded-xl mb-2"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600"
                      >
                        Remove
                      </button>
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

                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting || uploadingImage}>
                    {uploadingImage ? 'Uploading image…' : submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Item'}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setImageFile(null); setImagePreview(null) }}
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
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.id} className={item.is_active ? '' : 'opacity-60'}>
                  <Card.Body>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          {!item.is_active && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
                        )}
                        <p className="text-sm text-primary-600 font-medium mt-1">
                          {item.cost} pts
                          {item.quantity !== null && (
                            <span className="text-gray-500 font-normal ml-2">
                              · {item.quantity} max
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                          Edit
                        </Button>
                        {item.is_active ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDeactivate(item.id)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReactivate(item.id)}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
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
                        <th className="pb-2 pr-4 font-medium">Points</th>
                        <th className="pb-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {redemptions.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 pr-4 font-medium text-gray-900">
                            {r.student_name}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{r.item_title}</td>
                          <td className="py-2 pr-4 text-primary-600 font-semibold">
                            -{r.points_spent}
                          </td>
                          <td className="py-2 text-gray-500">
                            {new Date(r.redeemed_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
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
