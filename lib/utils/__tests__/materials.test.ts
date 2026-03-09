/**
 * Tests for Materials Management Utilities
 */

import {
  validateFile,
  getFileIcon,
  formatFileSize,
  getMaterialTypeLabel
} from '../materials'

describe('validateFile', () => {
  test('accepts valid PDF file under size limit', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('accepts valid Word document', () => {
    const file = new File(['content'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    Object.defineProperty(file, 'size', { value: 1024 * 1024 })
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
  })

  test('accepts valid image file', () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 * 1024 })
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
  })

  test('rejects file over 50MB', () => {
    const file = new File(['content'], 'large.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 }) // 51MB
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too large')
    expect(result.error).toContain('50MB')
  })

  test('rejects unsupported file type', () => {
    const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' })
    Object.defineProperty(file, 'size', { value: 1024 })
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not supported')
  })

  test('accepts file at exactly 50MB', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 }) // Exactly 50MB
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
  })

  test('accepts PowerPoint file', () => {
    const file = new File(['content'], 'test.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    })
    Object.defineProperty(file, 'size', { value: 1024 * 1024 })
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
  })

  test('accepts video file', () => {
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 })
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
  })

  test('accepts text file', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'size', { value: 1024 })
    
    const result = validateFile(file)
    
    expect(result.valid).toBe(true)
  })
})

describe('getFileIcon', () => {
  test('returns correct icon for PDF', () => {
    expect(getFileIcon('application/pdf')).toBe('📄')
  })

  test('returns correct icon for Word document', () => {
    expect(getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('📝')
    expect(getFileIcon('application/msword')).toBe('📝')
  })

  test('returns correct icon for PowerPoint', () => {
    expect(getFileIcon('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('📊')
    expect(getFileIcon('application/vnd.ms-powerpoint')).toBe('📊')
  })

  test('returns correct icon for images', () => {
    expect(getFileIcon('image/jpeg')).toBe('🖼️')
    expect(getFileIcon('image/png')).toBe('🖼️')
    expect(getFileIcon('image/gif')).toBe('🖼️')
  })

  test('returns correct icon for videos', () => {
    expect(getFileIcon('video/mp4')).toBe('🎥')
    expect(getFileIcon('video/webm')).toBe('🎥')
  })

  test('returns correct icon for text files', () => {
    expect(getFileIcon('text/plain')).toBe('📃')
  })

  test('returns default icon for unknown type', () => {
    expect(getFileIcon('application/unknown')).toBe('📎')
  })
})

describe('formatFileSize', () => {
  test('formats bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
    expect(formatFileSize(500)).toBe('500 Bytes')
    expect(formatFileSize(1023)).toBe('1023 Bytes')
  })

  test('formats kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(10240)).toBe('10 KB')
  })

  test('formats megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    expect(formatFileSize(50 * 1024 * 1024)).toBe('50 MB')
  })

  test('formats gigabytes correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  test('rounds to 2 decimal places', () => {
    expect(formatFileSize(1234567)).toBe('1.18 MB')
    expect(formatFileSize(9876543)).toBe('9.42 MB')
  })
})

describe('getMaterialTypeLabel', () => {
  test('returns correct label for document', () => {
    expect(getMaterialTypeLabel('document')).toBe('Document')
  })

  test('returns correct label for link', () => {
    expect(getMaterialTypeLabel('link')).toBe('Link')
  })

  test('returns correct label for note', () => {
    expect(getMaterialTypeLabel('note')).toBe('Note')
  })

  test('returns correct label for recording', () => {
    expect(getMaterialTypeLabel('recording')).toBe('Recording')
  })

  test('returns input for unknown type', () => {
    expect(getMaterialTypeLabel('unknown')).toBe('unknown')
  })
})

// Note: uploadMaterial, getMaterialsByOccurrence, downloadMaterial, and deleteMaterial
// require Supabase client and are better tested with integration tests
// These tests focus on pure utility functions that don't require external dependencies
