/**
 * Session Materials Management Utilities
 * 
 * Handles uploading, downloading, and managing materials for class sessions.
 * Materials are stored in Supabase Storage (session-materials bucket).
 */

import { createClient } from '@/lib/supabase/client'

export interface MaterialUploadOptions {
  occurrenceId: string
  file: File
  title: string
  description?: string
  materialType?: 'document' | 'link' | 'note' | 'recording'
}

export interface MaterialRecord {
  id: string
  occurrence_id: string
  uploaded_by: string
  title: string
  description: string | null
  file_url: string
  file_type: string
  file_size: number
  material_type: 'document' | 'link' | 'note' | 'recording'
  is_available: boolean
  uploaded_at: string
}

export interface UploadResult {
  success: boolean
  material?: MaterialRecord
  error?: string
}

// File size limit: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'text/plain'
]

/**
 * Validate file before upload
 * 
 * @param file - File to validate
 * @returns Object with valid flag and error message if invalid
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`
    }
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Allowed types: PDF, Word, PowerPoint, images, videos, and text files.`
    }
  }

  return { valid: true }
}

/**
 * Upload material file to storage and create database record
 * 
 * @param options - Upload options (occurrenceId, file, title, etc.)
 * @returns Upload result with material record or error
 * 
 * @example
 * const result = await uploadMaterial({
 *   occurrenceId: 'occurrence-123',
 *   file: pdfFile,
 *   title: 'Algebra Lesson 1',
 *   description: 'Introduction to linear equations',
 *   materialType: 'document'
 * })
 * 
 * if (result.success) {
 *   console.log('Material uploaded:', result.material)
 * } else {
 *   console.error('Upload failed:', result.error)
 * }
 */
export async function uploadMaterial(
  options: MaterialUploadOptions
): Promise<UploadResult> {
  const { occurrenceId, file, title, description, materialType = 'document' } = options
  const supabase = createClient()

  try {
    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get class_id from occurrence
    const { data: occurrence, error: occurrenceError } = await supabase
      .from('class_occurrences')
      .select('class_id')
      .eq('id', occurrenceId)
      .single()

    if (occurrenceError || !occurrence) {
      return { success: false, error: 'Occurrence not found' }
    }

    // Generate unique file name
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    const fileName = `${timestamp}-${sanitizedTitle}.${fileExt}`
    
    // Storage path: {class_id}/{occurrence_id}/{filename}
    const filePath = `${occurrence.class_id}/${occurrenceId}/${fileName}`

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('session-materials')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('session-materials')
      .getPublicUrl(filePath)

    // Create database record
    const { data: material, error: dbError } = await supabase
      .from('session_materials')
      .insert({
        occurrence_id: occurrenceId,
        uploaded_by: user.id,
        title,
        description: description || null,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        material_type: materialType,
        is_available: true
      })
      .select()
      .single()

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from('session-materials')
        .remove([filePath])
      
      return { success: false, error: `Database error: ${dbError.message}` }
    }

    return { success: true, material }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Get all materials for a specific occurrence
 * 
 * @param occurrenceId - UUID of the occurrence
 * @returns Array of material records
 */
export async function getMaterialsByOccurrence(
  occurrenceId: string
): Promise<MaterialRecord[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('session_materials')
    .select('*')
    .eq('occurrence_id', occurrenceId)
    .eq('is_available', true)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch materials:', error)
    return []
  }

  return data || []
}

/**
 * Get all materials for a class (across all occurrences)
 * 
 * @param classId - UUID of the class
 * @returns Array of material records with occurrence info
 */
export async function getMaterialsByClass(classId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('session_materials')
    .select(`
      *,
      class_occurrences!inner(
        class_id,
        occurrence_date,
        session_number
      )
    `)
    .eq('class_occurrences.class_id', classId)
    .eq('is_available', true)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch class materials:', error)
    return []
  }

  return data || []
}

/**
 * Download material file
 * Triggers browser download
 * 
 * @param material - Material record
 */
export async function downloadMaterial(material: MaterialRecord): Promise<void> {
  try {
    const supabase = createClient()
    
    // Extract file path from URL
    const url = new URL(material.file_url)
    const pathParts = url.pathname.split('/')
    
    // Find bucket name in path (could be 'session-materials' or 'object')
    let bucketIndex = pathParts.indexOf('session-materials')
    if (bucketIndex === -1) {
      bucketIndex = pathParts.indexOf('object')
    }
    
    if (bucketIndex === -1) {
      throw new Error('Could not determine file path from URL')
    }
    
    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    // Try to download file using storage API
    const { data, error } = await supabase.storage
      .from('session-materials')
      .download(filePath)

    if (error) {
      // If storage download fails, try direct fetch from public URL
      console.warn('Storage download failed, trying direct fetch:', error.message)
      const response = await fetch(material.file_url)
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`)
      }
      const blob = await response.blob()
      
      // Trigger download
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = material.title + '.' + (material.file_type.split('/').pop() || 'file')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      return
    }

    // Create blob URL and trigger download
    const blob = new Blob([data], { type: material.file_type })
    const blobUrl = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = material.title + '.' + (material.file_type.split('/').pop() || 'file')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up blob URL
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('Download error:', error)
    throw error
  }
}

/**
 * Delete material (file and database record)
 * Only uploader or teachers with permission can delete
 * 
 * @param materialId - UUID of the material
 * @returns Success status
 */
export async function deleteMaterial(materialId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Get material record
    const { data: material, error: fetchError } = await supabase
      .from('session_materials')
      .select('file_url')
      .eq('id', materialId)
      .single()

    if (fetchError || !material) {
      return { success: false, error: 'Material not found' }
    }

    // Extract file path from URL
    const url = new URL(material.file_url)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.indexOf('session-materials')
    const filePath = pathParts.slice(bucketIndex + 1).join('/')

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('session-materials')
      .remove([filePath])

    if (storageError) {
      console.error('Storage deletion failed:', storageError)
      // Continue to delete database record even if storage fails
    }

    // Delete database record (RLS will check permissions)
    const { error: dbError } = await supabase
      .from('session_materials')
      .delete()
      .eq('id', materialId)

    if (dbError) {
      return { success: false, error: `Failed to delete: ${dbError.message}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Update material availability (hide/show)
 * 
 * @param materialId - UUID of the material
 * @param isAvailable - Whether material should be visible to students
 * @returns Success status
 */
export async function updateMaterialAvailability(
  materialId: string,
  isAvailable: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { error } = await supabase
    .from('session_materials')
    .update({ is_available: isAvailable })
    .eq('id', materialId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Get file icon based on MIME type
 * 
 * @param mimeType - MIME type of the file
 * @returns Emoji icon representing the file type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎥'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊'
  if (mimeType.includes('text')) return '📃'
  return '📎'
}

/**
 * Format file size for display
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string like "2.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get material type label for display
 * 
 * @param materialType - Material type enum value
 * @returns User-friendly label
 */
export function getMaterialTypeLabel(materialType: string): string {
  const labels: Record<string, string> = {
    document: 'Document',
    link: 'Link',
    note: 'Note',
    recording: 'Recording'
  }
  return labels[materialType] || materialType
}
