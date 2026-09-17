// lib/utils/imageCompression.ts
//
// Client-side image compression before upload.
// Resizes images that exceed a max dimension and re-encodes as JPEG/WebP
// to cut file size significantly before they hit Supabase Storage.
//
// Rules:
//   - Non-image files (PDFs, etc.) pass through untouched
//   - Images already below the size threshold pass through untouched
//   - Max dimension: 2000px on the longest side (preserves aspect ratio)
//   - Output quality: 0.85 JPEG (good quality, ~60-80% smaller than uncompressed)
//   - Falls back gracefully — if canvas fails, returns original file

export interface CompressionOptions {
  /** Max pixels on the longest side. Default: 2000 */
  maxDimension?: number
  /** JPEG quality 0-1. Default: 0.85 */
  quality?: number
  /** Skip compression if file is already under this size in bytes. Default: 500KB */
  skipBelowBytes?: number
}

/**
 * Compress an image file client-side using the Canvas API.
 * Returns the original file unchanged if it's not an image or doesn't need compression.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxDimension = 2000,
    quality = 0.85,
    skipBelowBytes = 500 * 1024, // 500KB
  } = options

  // Only compress images
  if (!file.type.startsWith('image/')) {
    return file
  }

  // Skip GIFs — canvas flattens animation
  if (file.type === 'image/gif') {
    return file
  }

  // Skip small files — not worth the CPU cost
  if (file.size <= skipBelowBytes) {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    // Check if resize is needed
    const longestSide = Math.max(width, height)
    let targetWidth = width
    let targetHeight = height

    if (longestSide > maxDimension) {
      const scale = maxDimension / longestSide
      targetWidth = Math.round(width * scale)
      targetHeight = Math.round(height * scale)
    }

    // If no resize needed and file is already JPEG/WebP, skip
    const isAlreadyOptimized = file.type === 'image/jpeg' || file.type === 'image/webp'
    if (targetWidth === width && targetHeight === height && isAlreadyOptimized) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    bitmap.close()

    // Prefer WebP for better compression; fall back to JPEG
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const outputQuality = outputType === 'image/png' ? undefined : quality

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputQuality)
    })

    if (!blob) return file

    // Only use compressed version if it's actually smaller
    if (blob.size >= file.size) return file

    const ext = outputType === 'image/jpeg' ? 'jpg' : 'png'
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const compressedFile = new File([blob], `${baseName}.${ext}`, {
      type: outputType,
      lastModified: Date.now(),
    })

    console.log(
      `[imageCompression] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB` +
      ` (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction, ${targetWidth}×${targetHeight})`
    )

    return compressedFile
  } catch (err) {
    // Canvas not available (SSR, test env) — return original
    console.warn('[imageCompression] Compression failed, using original:', err)
    return file
  }
}

/**
 * Compress multiple images in parallel.
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)))
}
