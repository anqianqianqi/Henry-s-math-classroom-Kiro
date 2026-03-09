'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface SubmissionFormProps {
  assignmentId: string
  assignmentTitle: string
  dueDate: string
  submissionType: 'file' | 'text' | 'link'
  pointsPossible: number
  existingSubmission?: Submission | null
  onSubmit: () => void
  onCancel?: () => void
}

interface Submission {
  id: string
  file_url?: string
  text_content?: string
  link_url?: string
  comments?: string
  submitted_at: string
  is_late: boolean
  version: number
}

export default function SubmissionForm({
  assignmentId,
  assignmentTitle,
  dueDate,
  submissionType,
  pointsPossible,
  existingSubmission,
  onSubmit,
  onCancel
}: SubmissionFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [textContent, setTextContent] = useState(existingSubmission?.text_content || '')
  const [linkUrl, setLinkUrl] = useState(existingSubmission?.link_url || '')
  const [comments, setComments] = useState(existingSubmission?.comments || '')
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const isLate = new Date() > new Date(dueDate)
  const isResubmission = !!existingSubmission

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`
    }
    return null
  }

  function handleFileSelect(selectedFile: File) {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
      return
    }
    setFile(selectedFile)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate based on submission type
    if (submissionType === 'file' && !file && !existingSubmission) {
      setError('Please select a file to upload')
      return
    }
    if (submissionType === 'text' && !textContent.trim()) {
      setError('Please enter your answer')
      return
    }
    if (submissionType === 'link' && !linkUrl.trim()) {
      setError('Please enter a URL')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setUploadProgress(0)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Check if student already has a submission for this assignment
      const { data: existingSubmissions, error: checkError } = await supabase
        .from('homework_submissions')
        .select('id, file_url')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (checkError) throw checkError

      const isUpdate = !!existingSubmissions

      let fileUrl: string | undefined

      // Upload file if needed
      if (submissionType === 'file' && file) {
        const fileExt = file.name.split('.').pop()
        const timestamp = Date.now()
        const fileName = `${timestamp}-${file.name}`
        const filePath = `${assignmentId}/${user.id}/${fileName}`

        setUploadProgress(30)

        // Delete old file if updating
        if (isUpdate && existingSubmissions.file_url) {
          try {
            const oldPath = existingSubmissions.file_url.split('/').slice(-2).join('/')
            await supabase.storage
              .from('homework-submissions')
              .remove([oldPath])
          } catch (err) {
            console.warn('Failed to delete old file:', err)
          }
        }

        const { error: uploadError } = await supabase.storage
          .from('homework-submissions')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          })

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

        setUploadProgress(60)

        const { data: { publicUrl } } = supabase.storage
          .from('homework-submissions')
          .getPublicUrl(filePath)

        fileUrl = publicUrl
      }

      setUploadProgress(80)

      // Prepare submission data
      const submissionData = {
        assignment_id: assignmentId,
        student_id: user.id,
        submission_type: submissionType,
        file_url: submissionType === 'file' ? fileUrl : null,
        text_content: submissionType === 'text' ? textContent.trim() : null,
        link_url: submissionType === 'link' ? linkUrl.trim() : null,
        comments: comments.trim() || null,
        is_late: isLate,
        version: 1,
        submitted_at: new Date().toISOString()
      }

      // Debug: Log submission data to verify comments
      console.log('💾 Saving submission with data:', {
        ...submissionData,
        hasComments: !!submissionData.comments,
        commentsLength: submissionData.comments?.length || 0
      })

      if (isUpdate) {
        // Update existing submission
        const { error: updateError } = await supabase
          .from('homework_submissions')
          .update(submissionData)
          .eq('id', existingSubmissions.id)

        if (updateError) {
          // Clean up uploaded file if update fails
          if (fileUrl) {
            const filePath = fileUrl.split('/').slice(-2).join('/')
            await supabase.storage
              .from('homework-submissions')
              .remove([filePath])
          }
          throw new Error(`Update failed: ${updateError.message}`)
        }
      } else {
        // Create new submission
        const { error: insertError } = await supabase
          .from('homework_submissions')
          .insert(submissionData)

        if (insertError) {
          // Clean up uploaded file if insert fails
          if (fileUrl) {
            const filePath = fileUrl.split('/').slice(-2).join('/')
            await supabase.storage
              .from('homework-submissions')
              .remove([filePath])
          }
          throw new Error(`Submission failed: ${insertError.message}`)
        }
      }

      setUploadProgress(100)

      // Success!
      setTimeout(() => {
        onSubmit()
      }, 500)

    } catch (err) {
      console.error('Submission failed:', err)
      setError(err instanceof Error ? err.message : 'Submission failed')
      setUploadProgress(0)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>
          {isResubmission ? 'Resubmit Homework' : 'Submit Homework'}
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Assignment Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">{assignmentTitle}</h4>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Due: {new Date(dueDate).toLocaleString()}</span>
              <span>•</span>
              <span>{pointsPossible} points</span>
            </div>
          </div>

          {/* Late Warning */}
          {isLate && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ This assignment is past due. Your submission will be marked as late.
              </p>
            </div>
          )}

          {/* Resubmission Notice */}
          {isResubmission && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                ℹ️ You are resubmitting this assignment. This will create version {existingSubmission.version + 1}.
              </p>
            </div>
          )}

          {/* File Upload */}
          {submissionType === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload File <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <div className="text-3xl mb-2">📎</div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                      }}
                      className="mt-2"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="text-3xl mb-2">📁</div>
                    <p className="text-gray-700">Click to select a file</p>
                    <p className="text-sm text-gray-500 mt-1">Max 50MB</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Text Entry */}
          {submissionType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Answer <span className="text-red-500">*</span>
              </label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Type your answer here..."
                rows={10}
                disabled={submitting}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}

          {/* Link Entry */}
          {submissionType === 'link' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL <span className="text-red-500">*</span>
              </label>
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                disabled={submitting}
                required
              />
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any notes or comments for your teacher..."
              rows={3}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Submitting...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">⚠️ {error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : isResubmission ? 'Resubmit' : 'Submit'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card.Body>
    </Card>
  )
}
