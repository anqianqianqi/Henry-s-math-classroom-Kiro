'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Template {
  id: string
  title: string
  description: string
  created_by: string
  image_url: string | null
  is_public: boolean
  usage_count: number
  created_at: string
  profiles?: {
    full_name: string
  }
}

interface ChallengeTemplatesProps {
  onClose?: () => void
  onSelectTemplate?: (templateId: string) => void
}

export default function ChallengeTemplates({ onClose, onSelectTemplate }: ChallengeTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'my' | 'public' | 'all'>('my')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadCurrentUser()
    loadTemplates()
  }, [filter])

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
    }
  }

  async function loadTemplates() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('challenge_templates')
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'my') {
        query = query.eq('created_by', user.id)
      } else if (filter === 'public') {
        query = query.eq('is_public', true)
      } else {
        // 'all' - show user's templates and public templates
        query = query.or(`created_by.eq.${user.id},is_public.eq.true`)
      }

      const { data, error } = await query

      if (error) throw error
      setTemplates(data || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
      setMessage({ type: 'error', text: 'Failed to load templates' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(templateId: string, templateTitle: string) {
    if (!confirm(`Are you sure you want to delete the template "${templateTitle}"?`)) {
      return
    }

    setDeleting(templateId)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('challenge_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Template deleted successfully' })
      loadTemplates()
      
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to delete template:', err)
      setMessage({ type: 'error', text: 'Failed to delete template' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleUseTemplate(templateId: string) {
    if (onSelectTemplate) {
      onSelectTemplate(templateId)
    } else {
      // Navigate to create challenge page with template ID
      router.push(`/challenges/new?template=${templateId}`)
    }
  }

  async function handleTogglePublic(templateId: string, currentPublic: boolean) {
    try {
      const { error } = await supabase
        .from('challenge_templates')
        .update({ is_public: !currentPublic, updated_at: new Date().toISOString() })
        .eq('id', templateId)

      if (error) throw error

      setMessage({ 
        type: 'success', 
        text: currentPublic ? 'Template made private' : 'Template made public' 
      })
      loadTemplates()
      
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to toggle public status:', err)
      setMessage({ type: 'error', text: 'Failed to update template' })
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Challenge Templates</h2>
        {onClose && (
          <Button onClick={onClose} variant="ghost" size="sm">
            ✕
          </Button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex gap-4 items-center">
        <div className="flex gap-2">
          <Button
            variant={filter === 'my' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('my')}
          >
            My Templates
          </Button>
          <Button
            variant={filter === 'public' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('public')}
          >
            Public
          </Button>
          <Button
            variant={filter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>
        <Input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <Card.Body>
            <div className="text-center py-12">
              <div className="text-4xl mb-2">📝</div>
              <p className="text-gray-500">
                {searchQuery 
                  ? 'No templates found matching your search' 
                  : filter === 'my'
                  ? 'You haven\'t created any templates yet'
                  : 'No public templates available'}
              </p>
              {filter === 'my' && !searchQuery && (
                <p className="text-sm text-gray-400 mt-2">
                  Save a challenge as a template to reuse it later
                </p>
              )}
            </div>
          </Card.Body>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <Card.Body>
                <div className="space-y-3">
                  {/* Template Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {template.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {template.is_public && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            Public
                          </span>
                        )}
                        <span>Used {template.usage_count} times</span>
                      </div>
                    </div>
                  </div>

                    {/* Image Preview */}
                    {template.image_url && (
                      <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={template.image_url}
                          alt={template.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {template.description}
                    </p>

                    {/* Creator Info */}
                    {template.profiles && (
                      <p className="text-xs text-gray-500">
                        By {template.profiles.full_name}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      <Button
                        onClick={() => handleUseTemplate(template.id)}
                        size="sm"
                        className="flex-1"
                      >
                        Use Template
                      </Button>
                      {currentUserId === template.created_by && (
                        <>
                          <Button
                            onClick={() => handleTogglePublic(template.id, template.is_public)}
                            variant="secondary"
                            size="sm"
                          >
                            {template.is_public ? '🔒' : '🌐'}
                          </Button>
                          <Button
                            onClick={() => handleDelete(template.id, template.title)}
                            disabled={deleting === template.id}
                            variant="danger"
                            size="sm"
                          >
                            {deleting === template.id ? '...' : '🗑️'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>
          ))}
        </div>
      )}

      {/* Results Count */}
      {searchQuery && filteredTemplates.length > 0 && (
        <p className="text-sm text-gray-600 text-center">
          Showing {filteredTemplates.length} of {templates.length} templates
        </p>
      )}
    </div>
  )
}
