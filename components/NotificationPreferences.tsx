'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface NotificationPrefs {
  email_class_starting: boolean
  email_homework_graded: boolean
  email_new_comment: boolean
  email_homework_due_soon: boolean
  email_homework_assigned: boolean
  email_material_uploaded: boolean
  email_submission_received: boolean
  inapp_class_starting: boolean
  inapp_homework_graded: boolean
  inapp_new_comment: boolean
  inapp_homework_due_soon: boolean
  inapp_homework_assigned: boolean
  inapp_material_uploaded: boolean
  inapp_submission_received: boolean
  email_enabled: boolean
}

const notificationTypes = [
  {
    key: 'class_starting',
    icon: '⏰',
    title: 'Class Starting Soon',
    description: 'Notify me 15 minutes before class starts'
  },
  {
    key: 'homework_graded',
    icon: '✅',
    title: 'Homework Graded',
    description: 'When a teacher grades my homework'
  },
  {
    key: 'new_comment',
    icon: '💬',
    title: 'New Comments',
    description: 'When someone comments on my submission'
  },
  {
    key: 'homework_due_soon',
    icon: '⚠️',
    title: 'Homework Due Soon',
    description: 'Remind me 24 hours before homework is due'
  },
  {
    key: 'homework_assigned',
    icon: '📝',
    title: 'New Homework',
    description: 'When new homework is assigned'
  },
  {
    key: 'material_uploaded',
    icon: '📎',
    title: 'New Materials',
    description: 'When teacher uploads new materials'
  },
  {
    key: 'submission_received',
    icon: '📬',
    title: 'Submission Received',
    description: 'When a student submits homework (teachers only)'
  }
]

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') throw error

      if (data) {
        setPreferences(data)
      } else {
        // Create default preferences
        const defaultPrefs: NotificationPrefs = {
          email_class_starting: true,
          email_homework_graded: true,
          email_new_comment: true,
          email_homework_due_soon: true,
          email_homework_assigned: true,
          email_material_uploaded: true,
          email_submission_received: true,
          inapp_class_starting: true,
          inapp_homework_graded: true,
          inapp_new_comment: true,
          inapp_homework_due_soon: true,
          inapp_homework_assigned: true,
          inapp_material_uploaded: true,
          inapp_submission_received: true,
          email_enabled: true
        }
        setPreferences(defaultPrefs)
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
      setMessage({ type: 'error', text: 'Failed to load preferences' })
    } finally {
      setLoading(false)
    }
  }

  async function savePreferences() {
    if (!preferences) return

    try {
      setSaving(true)
      setMessage(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setMessage({ type: 'success', text: 'Preferences saved successfully!' })
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to save preferences:', err)
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setSaving(false)
    }
  }

  function toggleEmailEnabled() {
    if (!preferences) return
    setPreferences({
      ...preferences,
      email_enabled: !preferences.email_enabled
    })
  }

  function togglePreference(key: string, channel: 'email' | 'inapp') {
    if (!preferences) return
    const prefKey = `${channel}_${key}` as keyof NotificationPrefs
    setPreferences({
      ...preferences,
      [prefKey]: !preferences[prefKey]
    })
  }

  function setAllEmail(enabled: boolean) {
    if (!preferences) return
    setPreferences({
      ...preferences,
      email_class_starting: enabled,
      email_homework_graded: enabled,
      email_new_comment: enabled,
      email_homework_due_soon: enabled,
      email_homework_assigned: enabled,
      email_material_uploaded: enabled,
      email_submission_received: enabled
    })
  }

  function setAllInApp(enabled: boolean) {
    if (!preferences) return
    setPreferences({
      ...preferences,
      inapp_class_starting: enabled,
      inapp_homework_graded: enabled,
      inapp_new_comment: enabled,
      inapp_homework_due_soon: enabled,
      inapp_homework_assigned: enabled,
      inapp_material_uploaded: enabled,
      inapp_submission_received: enabled
    })
  }

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  if (!preferences) {
    return (
      <Card>
        <Card.Body>
          <p className="text-center text-gray-500">Failed to load preferences</p>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>Notification Preferences</Card.Title>
        <p className="text-sm text-gray-600 mt-1">
          Choose how you want to receive notifications
        </p>
      </Card.Header>
      <Card.Body>
        <div className="space-y-6">
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

          {/* Email Master Toggle */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Email Notifications</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {preferences.email_enabled 
                    ? 'Email notifications are enabled' 
                    : 'Email notifications are disabled'}
                </p>
              </div>
              <button
                onClick={toggleEmailEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.email_enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.email_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => setAllEmail(true)}
              variant="secondary"
              size="sm"
              disabled={!preferences.email_enabled}
            >
              Enable All Email
            </Button>
            <Button
              onClick={() => setAllEmail(false)}
              variant="secondary"
              size="sm"
              disabled={!preferences.email_enabled}
            >
              Disable All Email
            </Button>
            <Button
              onClick={() => setAllInApp(true)}
              variant="secondary"
              size="sm"
            >
              Enable All In-App
            </Button>
            <Button
              onClick={() => setAllInApp(false)}
              variant="secondary"
              size="sm"
            >
              Disable All In-App
            </Button>
          </div>

          {/* Notification Types Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    Notification Type
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                    In-App
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {notificationTypes.map((type) => {
                  const inappKey = `inapp_${type.key}` as keyof NotificationPrefs
                  const emailKey = `email_${type.key}` as keyof NotificationPrefs
                  
                  return (
                    <tr key={type.key} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{type.icon}</span>
                          <div>
                            <div className="font-medium text-gray-900">{type.title}</div>
                            <div className="text-sm text-gray-600">{type.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => togglePreference(type.key, 'inapp')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            preferences[inappKey] ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preferences[inappKey] ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => togglePreference(type.key, 'email')}
                          disabled={!preferences.email_enabled}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            preferences.email_enabled && preferences[emailKey]
                              ? 'bg-blue-600'
                              : 'bg-gray-300'
                          } ${!preferences.email_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preferences[emailKey] ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">📧 About Email Notifications</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• In-app notifications appear in the bell icon at the top of the page</li>
              <li>• Email notifications are sent to your registered email address</li>
              <li>• You can customize each notification type independently</li>
              <li>• Changes take effect immediately</li>
            </ul>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={loadPreferences}
              variant="secondary"
              disabled={saving}
            >
              Reset
            </Button>
            <Button
              onClick={savePreferences}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
