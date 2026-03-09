'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadMaterial } from '@/lib/utils/materials'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface MaterialUploadProps {
  occurrenceId: string
  classId: string
  onUploadComplete: () => void
  onCancel?: () => void
}

export default function MaterialUpload({
  occurrenceId,
  classId,
  onUploadComplete,
  onCancel
}: MaterialUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [materialType, setMaterialType] = useState<'document' | 'link' | 'note' | 'recording'>('document')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'text/plain'
  ]

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type not supported: ${file.type}`
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
    
    // Auto-fill title from filename if empty
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt)
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  async function handleUpload() {
    // Validation based on material type
    if (materialType === 'link') {
      if (!title.trim() || !linkUrl.trim()) {
        setError('Please provide a title and URL for the link')
        return
      }
      // Validate URL format
      try {
        new URL(linkUrl)
      } catch {
        setError('Please enter a valid URL (e.g., https://example.com)')
        return
      }
    } else {
      if (!file || !title.trim()) {
        setError('Please select a file and provide a title')
        return
      }
    }

    try {
      setUploading(true)
      setError(null)
      setUploadProgress(0)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Handle link-type materials differently
      if (materialType === 'link') {
        // Create database record directly for links
        const { error: dbError } = await supabase
          .from('session_materials')
          .insert({
            occurrence_id: occurrenceId,
            uploaded_by: user.id,
            title: title.trim(),
            description: description.trim() || null,
            file_url: linkUrl.trim(),
            file_type: 'text/uri-list',
            file_size: 0,
            material_type: 'link',
            is_available: true
          })

        if (dbError) {
          throw new Error(`Failed to save link: ${dbError.message}`)
        }

        setUploadProgress(100)
        setTimeout(() => {
          onUploadComplete()
        }, 300)
        return
      }

      // Handle file uploads
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const result = await uploadMaterial({
        occurrenceId,
        file: file!,
        title: title.trim(),
        description: description.trim() || undefined,
        materialType
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }

      // Success!
      setTimeout(() => {
        onUploadComplete()
      }, 500)

    } catch (err) {
      console.error('Upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>Upload Material</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          {/* Material Type - Move to top */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Material Type
            </label>
            <select
              value={materialType}
              onChange={(e) => {
                setMaterialType(e.target.value as any)
                setError(null)
              }}
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="document">Document (File Upload)</option>
              <option value="link">Link (External URL)</option>
              <option value="note">Note (File Upload)</option>
              <option value="recording">Recording (File Upload)</option>
            </select>
          </div>

          {/* Conditional: File Drop Zone OR Link Input */}
          {materialType === 'link' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL <span className="text-red-500">*</span>
              </label>
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/resource"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a full URL including https://
              </p>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
                accept={ALLOWED_TYPES.join(',')}
              />
              
              {file ? (
                <div>
                  <div className="text-4xl mb-2">📎</div>
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
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-gray-700 mb-1">
                    Drag and drop a file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    PDF, DOC, PPT, images, videos (max 50MB)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Lecture Slides - Chapter 3"
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this material..."
              rows={3}
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>



          {/* Upload Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
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
            <Button
              onClick={handleUpload}
              disabled={
                uploading || 
                !title.trim() || 
                (materialType === 'link' ? !linkUrl.trim() : !file)
              }
            >
              {uploading ? 'Uploading...' : materialType === 'link' ? 'Add Link' : 'Upload'}
            </Button>
            {onCancel && (
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={uploading}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
