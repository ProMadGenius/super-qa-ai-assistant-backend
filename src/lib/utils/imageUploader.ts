/**
 * Internal Image Upload Utilities
 * Handles image processing without HTTP requests
 */

import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface ImageUploadRequest {
  data: string // base64 data URL
  mime: string
  name: string
  source: 'attachment' | 'comment'
}

export interface UploadedImage {
  originalName: string
  filename: string
  url: string
  absoluteUrl: string // Full URL for AI processing
  size: number
  mimeType: string
  source: 'attachment' | 'comment'
}

/**
 * Upload images directly to filesystem (internal function)
 */
export async function uploadImagesInternal(
  images: ImageUploadRequest[]
): Promise<UploadedImage[]> {
  if (images.length === 0) {
    return []
  }

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  const uploadedImages: UploadedImage[] = []

  for (const image of images) {
    try {
      const { data, mime, name, source } = image
      
      // Handle different base64 formats
      let base64Data: string
      let mimeType: string
      let extension: string

      if (data.startsWith('data:image/')) {
        // Standard data URL format: data:image/png;base64,iVBORw0KGgo...
        base64Data = data.split(',')[1]
        mimeType = data.split(';')[0].split(':')[1]
        extension = mimeType.split('/')[1]
      } else if (data.match(/^[A-Za-z0-9+/]/) && mime) {
        // Raw base64 data with separate mime type
        base64Data = data
        mimeType = mime
        extension = mime.split('/')[1]
        console.log(`📝 Processing raw base64 for ${name} (${mime})`)
      } else {
        console.warn(`❌ Skipping invalid image format: ${name}`)
        console.warn(`   Data starts with: ${data.substring(0, 50)}...`)
        console.warn(`   MIME type: ${mime}`)
        continue
      }
      
      // Generate unique filename
      const uniqueId = uuidv4()
      const filename = `${uniqueId}.${extension}`
      const filepath = path.join(uploadsDir, filename)
      
      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Data, 'base64')
      await writeFile(filepath, buffer)
      
      // Create public URLs
      const publicUrl = `/uploads/${filename}`
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000'
      const absoluteUrl = `${baseUrl}${publicUrl}`
      
      uploadedImages.push({
        originalName: name,
        filename,
        url: publicUrl,
        absoluteUrl: absoluteUrl,
        size: buffer.length,
        mimeType,
        source
      })
      
      console.log(`📁 Saved image: ${name} -> ${filename} (${buffer.length} bytes)`)
    } catch (error) {
      console.error(`❌ Failed to save image ${image.name}:`, error)
      // Continue with other images
    }
  }

  return uploadedImages
}

/**
 * Prepare images from ticket attachments for upload
 */
export function prepareAttachmentImages(
  attachments: Array<{data: string, mime: string, name: string, tooBig: boolean}>
): ImageUploadRequest[] {
  return attachments
    .filter(att => att.mime.startsWith('image/') && !att.tooBig && att.data)
    .map(att => ({
      data: att.data,
      mime: att.mime,
      name: att.name,
      source: 'attachment' as const
    }))
}

/**
 * Prepare images from comments for upload
 */
export function prepareCommentImages(
  comments: Array<{images?: Array<{src: string, filename: string, alt: string}>}>
): ImageUploadRequest[] {
  const commentImages: ImageUploadRequest[] = []
  
  for (const comment of comments) {
    if (comment.images) {
      for (const image of comment.images) {
        // Only process base64 images from comments
        if (image.src.startsWith('data:image/')) {
          commentImages.push({
            data: image.src,
            mime: image.src.split(';')[0].split(':')[1],
            name: image.filename,
            source: 'comment' as const
          })
        }
      }
    }
  }
  
  return commentImages
}