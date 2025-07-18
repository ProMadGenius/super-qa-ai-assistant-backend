/**
 * Advanced Image Processing Utilities
 * Handles image optimization, resizing, and format conversion
 */

import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface ImageProcessingConfig {
  maxSizeMB: number
  quality: number
  maxWidth: number
  maxHeight: number
  resizeEnabled: boolean
  compressionEnabled: boolean
  formatConversion: boolean
}

export interface ImageUploadRequest {
  data: string // base64 data URL
  mime: string
  name: string
  source: 'attachment' | 'comment'
}

export interface ProcessedImage {
  originalName: string
  filename: string
  url: string
  absoluteUrl: string
  size: number
  originalSize: number
  mimeType: string
  source: 'attachment' | 'comment'
  dimensions: {
    width: number
    height: number
  }
  processed: boolean
  processingInfo?: {
    resized: boolean
    compressed: boolean
    formatChanged: boolean
    qualityApplied: number
  }
}

/**
 * Get image processing configuration from environment variables
 */
function getImageConfig(): ImageProcessingConfig {
  return {
    maxSizeMB: parseInt(process.env.IMAGE_MAX_SIZE_MB || '10'),
    quality: parseInt(process.env.IMAGE_QUALITY || '95'),
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '2048'),
    maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '2048'),
    resizeEnabled: process.env.IMAGE_RESIZE_ENABLED === 'true',
    compressionEnabled: process.env.IMAGE_COMPRESSION_ENABLED === 'true',
    formatConversion: process.env.IMAGE_FORMAT_CONVERSION === 'true'
  }
}

/**
 * Process and optimize images using Sharp
 */
export async function processAndUploadImages(
  images: ImageUploadRequest[]
): Promise<ProcessedImage[]> {
  if (images.length === 0) {
    return []
  }

  const config = getImageConfig()
  console.log('🎨 Image processing config:', config)

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  const processedImages: ProcessedImage[] = []

  for (const image of images) {
    try {
      const { data, mime, name, source } = image

      // Handle different base64 formats
      let base64Data: string
      let mimeType: string

      if (data.startsWith('data:image/')) {
        base64Data = data.split(',')[1]
        mimeType = data.split(';')[0].split(':')[1]
      } else if (data.match(/^[A-Za-z0-9+/]/) && mime) {
        base64Data = data
        mimeType = mime
      } else {
        console.warn(`❌ Skipping invalid image format: ${name}`)
        continue
      }

      // Convert base64 to buffer
      const originalBuffer = Buffer.from(base64Data, 'base64')
      const originalSize = originalBuffer.length

      console.log(`🖼️ Processing ${name} (${(originalSize / 1024).toFixed(1)}KB, ${mimeType})`)



      // Check if image exceeds size limit
      const maxSizeBytes = config.maxSizeMB * 1024 * 1024
      if (originalSize > maxSizeBytes) {
        console.warn(`⚠️ Image ${name} exceeds size limit (${(originalSize / 1024 / 1024).toFixed(1)}MB > ${config.maxSizeMB}MB)`)
        continue
      }

      // Initialize Sharp instance
      let sharpInstance = sharp(originalBuffer)

      // Get original image metadata
      const metadata = await sharpInstance.metadata()
      console.log(`📏 Original dimensions: ${metadata.width}x${metadata.height}`)

      let processed = false
      const processingInfo = {
        resized: false,
        compressed: false,
        formatChanged: false,
        qualityApplied: config.quality
      }

      // Resize if enabled and image is too large
      if (config.resizeEnabled && metadata.width && metadata.height) {
        if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
          sharpInstance = sharpInstance.resize(config.maxWidth, config.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          processingInfo.resized = true
          processed = true
          console.log(`📐 Resizing to max ${config.maxWidth}x${config.maxHeight}`)
        }
      }

      // Determine output format
      let outputFormat: 'png' | 'jpeg' | 'webp' = 'png'
      let extension = 'png'

      if (config.formatConversion) {
        // Use PNG for screenshots/UI elements, JPEG for photos
        if (name.toLowerCase().includes('screenshot') ||
          name.toLowerCase().includes('image-') ||
          mimeType === 'image/png') {
          outputFormat = 'png'
          extension = 'png'
        } else {
          outputFormat = 'jpeg'
          extension = 'jpg'
          processingInfo.formatChanged = mimeType !== 'image/jpeg'
        }
      } else {
        // Keep original format
        if (mimeType === 'image/jpeg') {
          outputFormat = 'jpeg'
          extension = 'jpg'
        } else if (mimeType === 'image/webp') {
          outputFormat = 'webp'
          extension = 'webp'
        }
      }

      // IMPORTANT: Only apply processing if explicitly enabled
      // By default, save the original image without any processing
      let processedBuffer: Buffer

      if (config.compressionEnabled || config.resizeEnabled || processingInfo.resized) {
        console.log(`🔧 Applying processing (compression=${config.compressionEnabled}, resize=${processingInfo.resized})`)

        // Apply format-specific processing only if needed
        if (outputFormat === 'jpeg') {
          sharpInstance = sharpInstance.jpeg({
            quality: config.quality,
            progressive: true,
            mozjpeg: true
          })
          processingInfo.compressed = true
          processed = true
        } else if (outputFormat === 'png') {
          sharpInstance = sharpInstance.png({
            quality: config.quality,
            compressionLevel: config.compressionEnabled ? 9 : 6,
            progressive: true
          })
          processingInfo.compressed = true
          processed = true
        } else if (outputFormat === 'webp') {
          sharpInstance = sharpInstance.webp({
            quality: config.quality,
            effort: 6
          })
          processingInfo.compressed = true
          processed = true
        }

        processedBuffer = await sharpInstance.toBuffer()
      } else {
        console.log(`📋 Saving original image without processing`)
        // Save original image without any processing
        processedBuffer = originalBuffer
        processed = false
      }

      // Generate unique filename
      const uniqueId = uuidv4()
      const filename = `${uniqueId}.${extension}`
      const filepath = path.join(uploadsDir, filename)

      // Save the processed image (using the processedBuffer from above)
      await writeFile(filepath, processedBuffer)
      console.log(`💾 Saved ${filename} (${(processedBuffer.length / 1024).toFixed(1)}KB)`)

      // Get final image metadata
      const finalMetadata = await sharp(processedBuffer).metadata()

      // Create URLs
      const publicUrl = `/uploads/${filename}`
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000'
      const absoluteUrl = `${baseUrl}${publicUrl}`

      processedImages.push({
        originalName: name,
        filename,
        url: publicUrl,
        absoluteUrl: absoluteUrl,
        size: processedBuffer.length,
        originalSize: originalSize,
        mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        source,
        dimensions: {
          width: finalMetadata.width || 0,
          height: finalMetadata.height || 0
        },
        processed,
        processingInfo: processed ? processingInfo : undefined
      })

      const sizeDiff = originalSize - processedBuffer.length
      const sizeReduction = ((sizeDiff / originalSize) * 100).toFixed(1)

      console.log(`✅ Processed ${name}:`)
      console.log(`   📁 Saved as: ${filename}`)
      console.log(`   📏 Final size: ${(processedBuffer.length / 1024).toFixed(1)}KB (${sizeReduction}% reduction)`)
      console.log(`   📐 Final dimensions: ${finalMetadata.width}x${finalMetadata.height}`)
      console.log(`   🔧 Processing applied: ${processed ? 'Yes' : 'No'}`)

    } catch (error) {
      console.error(`❌ Failed to process image ${image.name}:`, error)
      // Continue with other images
    }
  }

  return processedImages
}

/**
 * Prepare images from ticket attachments for processing
 */
export function prepareAttachmentImages(
  attachments: Array<{ data: string, mime: string, name: string, tooBig: boolean }>
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
 * Prepare images from comments for processing
 */
export function prepareCommentImages(
  comments: Array<{ images?: Array<{ src: string, filename: string, alt: string }> }>
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