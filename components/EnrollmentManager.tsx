'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Member {
  id: string
  user_id: string
  role_name: string
  profiles: {
    full_name: string
    email: string
  }
  joined_at?: string
}

interface EnrollmentManagerProps {
  classId: string
  members: Member[]
  onMembersUpdate: () => void
}

export default function EnrollmentManager({ classId, members, onMembersUpdate }: EnrollmentManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [enrollEmail, setEnrollEmail] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [bulkEnrolling, setBulkEnrolling] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Filter members based on search query
  const filteredMembers = members.filter(member =>
    member.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.profiles.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  async function handleEnrollStudent() {
    if (!enrollEmail.trim()) return

    setEnrolling(true)
    setMessage(null)

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', enrollEmail.trim().toLowerCase())
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile) {
        setMessage({ type: 'error', text: 'No user found with that email address' })
        setEnrolling(false)
        return
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', classId)
        .eq('user_id', profile.id)
        .maybeSingle()

      if (existing) {
        setMessage({ type: 'error', text: `${profile.full_name} is already enrolled in this class` })
        setEnrolling(false)
        return
      }

      // Enroll student
      const { error: enrollError } = await supabase
        .from('class_members')
        .insert({
          class_id: classId,
          user_id: profile.id
        })

      if (enrollError) throw enrollError

      setMessage({ type: 'success', text: `Successfully enrolled ${profile.full_name}` })
      setEnrollEmail('')
      onMembersUpdate()
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to enroll student:', err)
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to enroll student' })
    } finally {
      setEnrolling(false)
    }
  }

  async function handleRemoveStudent(userId: string, userName: string) {
    if (!confirm(`Are you sure you want to remove ${userName} from this class?`)) {
      return
    }

    setRemoving(userId)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('class_members')
        .delete()
        .eq('class_id', classId)
        .eq('user_id', userId)

      if (error) throw error

      setMessage({ type: 'success', text: `Successfully removed ${userName}` })
      onMembersUpdate()
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to remove student:', err)
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove student' })
    } finally {
      setRemoving(null)
    }
  }

  async function handleBulkUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setBulkEnrolling(true)
    setMessage(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').map(line => line.trim()).filter(line => line)
      
      // Parse CSV (simple: email or name,email)
      const emails: string[] = []
      for (const line of lines) {
        // Skip header row if it contains "email"
        if (line.toLowerCase().includes('email') && line.toLowerCase().includes('name')) continue
        
        const parts = line.split(',').map(p => p.trim())
        // If comma-separated, take the last part as email
        const email = parts.length > 1 ? parts[parts.length - 1] : parts[0]
        
        // Basic email validation
        if (email.includes('@')) {
          emails.push(email.toLowerCase())
        }
      }

      if (emails.length === 0) {
        setMessage({ type: 'error', text: 'No valid email addresses found in file' })
        setBulkEnrolling(false)
        return
      }

      // Find users by email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('email', emails)

      if (profileError) throw profileError

      if (!profiles || profiles.length === 0) {
        setMessage({ type: 'error', text: 'No users found with those email addresses' })
        setBulkEnrolling(false)
        return
      }

      // Get existing members
      const { data: existingMembers } = await supabase
        .from('class_members')
        .select('user_id')
        .eq('class_id', classId)

      const existingUserIds = new Set(existingMembers?.map(m => m.user_id) || [])

      // Filter out already enrolled students
      const newStudents = profiles.filter(p => !existingUserIds.has(p.id))

      if (newStudents.length === 0) {
        setMessage({ type: 'error', text: 'All students are already enrolled in this class' })
        setBulkEnrolling(false)
        return
      }

      // Enroll new students
      const enrollments = newStudents.map(student => ({
        class_id: classId,
        user_id: student.id
      }))

      const { error: enrollError } = await supabase
        .from('class_members')
        .insert(enrollments)

      if (enrollError) throw enrollError

      const notFound = emails.length - profiles.length
      const alreadyEnrolled = profiles.length - newStudents.length
      
      let successMessage = `Successfully enrolled ${newStudents.length} student(s)`
      if (alreadyEnrolled > 0) successMessage += `, ${alreadyEnrolled} already enrolled`
      if (notFound > 0) successMessage += `, ${notFound} not found`

      setMessage({ type: 'success', text: successMessage })
      setShowBulkUpload(false)
      onMembersUpdate()
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setMessage(null), 5000)
    } catch (err) {
      console.error('Failed to bulk enroll:', err)
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to bulk enroll students' })
    } finally {
      setBulkEnrolling(false)
    }
  }

  function downloadTemplate() {
    const csv = 'Name,Email\nJohn Doe,john@example.com\nJane Smith,jane@example.com'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'enrollment-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <Card.Title>Class Members ({members.length})</Card.Title>
          <Button
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            variant="secondary"
            size="sm"
          >
            {showBulkUpload ? 'Hide' : 'Bulk Upload'}
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
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

          {/* Bulk Upload Section */}
          {showBulkUpload && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <h4 className="font-semibold text-gray-900">Bulk Enrollment</h4>
              <p className="text-sm text-gray-600">
                Upload a CSV file with student email addresses. The file can have one email per line,
                or be formatted as "Name,Email" (name is optional).
              </p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleBulkUpload}
                  disabled={bulkEnrolling}
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  size="sm"
                >
                  Download Template
                </Button>
              </div>
              {bulkEnrolling && (
                <p className="text-sm text-blue-700">Processing file...</p>
              )}
            </div>
          )}

          {/* Single Student Enrollment */}
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter student email address"
              value={enrollEmail}
              onChange={(e) => setEnrollEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEnrollStudent()}
              disabled={enrolling}
            />
            <Button
              onClick={handleEnrollStudent}
              disabled={enrolling || !enrollEmail.trim()}
            >
              {enrolling ? 'Adding...' : 'Add Student'}
            </Button>
          </div>

          {/* Search */}
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Members List */}
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">👥</div>
              <p className="text-gray-500">
                {searchQuery ? 'No students found matching your search' : 'No students enrolled yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {member.profiles.full_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {member.profiles.email}
                    </div>
                    {member.joined_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleRemoveStudent(member.user_id, member.profiles.full_name)}
                    disabled={removing === member.user_id}
                    variant="danger"
                    size="sm"
                  >
                    {removing === member.user_id ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Results Count */}
          {searchQuery && (
            <p className="text-sm text-gray-600 text-center">
              Showing {filteredMembers.length} of {members.length} students
            </p>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}
