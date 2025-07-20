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

  console.log(`🚀 Processing ${images.length} images in parallel...`)
  const startTime = Date.now()

  // Process all images in parallel for better performance
  const imagePromises = images.map(async (image, index) => {
    const imageStartTime = Date.now()
    
    try {
      const { data, mime, name, source } = image

      console.log(`🖼️ [${index + 1}/${images.length}] Starting ${name}...`)

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
        console.warn(`❌ [${index + 1}] Skipping invalid image format: ${name}`)
        return null
      }

      // Convert base64 to buffer
      const bufferStartTime = Date.now()
      const originalBuffer = Buffer.from(base64Data, 'base64')
      const originalSize = originalBuffer.length
      const bufferTime = Date.now() - bufferStartTime

      console.log(`🖼️ [${index + 1}] ${name} buffer created (${(originalSize / 1024).toFixed(1)}KB, ${mimeType}) - ${bufferTime}ms`)

      // Check if image exceeds size limit
      const maxSizeBytes = config.maxSizeMB * 1024 * 1024
      if (originalSize > maxSizeBytes) {
        console.warn(`⚠️ [${index + 1}] Image ${name} exceeds size limit (${(originalSize / 1024 / 1024).toFixed(1)}MB > ${config.maxSizeMB}MB)`)
        return null
      }

      // Initialize Sharp instance
      const sharpStartTime = Date.now()
      let sharpInstance = sharp(originalBuffer)

      // Get original image metadata
      const metadata = await sharpInstance.metadata()
      const metadataTime = Date.now() - sharpStartTime
      console.log(`📏 [${index + 1}] Original dimensions: ${metadata.width}x${metadata.height} - ${metadataTime}ms`)

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
          console.log(`📐 [${index + 1}] Resizing to max ${config.maxWidth}x${config.maxHeight}`)
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
      const processingStartTime = Date.now()

      if (config.compressionEnabled || config.resizeEnabled || processingInfo.resized) {
        console.log(`🔧 [${index + 1}] Applying processing (compression=${config.compressionEnabled}, resize=${processingInfo.resized})`)

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
        console.log(`📋 [${index + 1}] Saving original image without processing`)
        // Save original image without any processing
        processedBuffer = originalBuffer
        processed = false
      }

      const processingTime = Date.now() - processingStartTime

      // Generate unique filename
      const uniqueId = uuidv4()
      const filename = `${uniqueId}.${extension}`
      const filepath = path.join(uploadsDir, filename)

      // Save the processed image (using the processedBuffer from above)
      const saveStartTime = Date.now()
      await writeFile(filepath, processedBuffer)
      const saveTime = Date.now() - saveStartTime
      console.log(`💾 [${index + 1}] Saved ${filename} (${(processedBuffer.length / 1024).toFixed(1)}KB) - ${saveTime}ms`)

      // Get final image metadata
      const finalMetadataStartTime = Date.now()
      const finalMetadata = await sharp(processedBuffer).metadata()
      const finalMetadataTime = Date.now() - finalMetadataStartTime

      // Create URLs
      const publicUrl = `/uploads/${filename}`
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000'
      const absoluteUrl = `${baseUrl}${publicUrl}`

      const result = {
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
      }

      const sizeDiff = originalSize - processedBuffer.length
      const sizeReduction = ((sizeDiff / originalSize) * 100).toFixed(1)
      const totalImageTime = Date.now() - imageStartTime

      console.log(`✅ [${index + 1}] Processed ${name} in ${totalImageTime}ms:`)
      console.log(`   📁 Saved as: ${filename}`)
      console.log(`   📏 Final size: ${(processedBuffer.length / 1024).toFixed(1)}KB (${sizeReduction}% reduction)`)
      console.log(`   📐 Final dimensions: ${finalMetadata.width}x${finalMetadata.height}`)
      console.log(`   🔧 Processing applied: ${processed ? 'Yes' : 'No'}`)
      console.log(`   ⏱️  Timings: buffer=${bufferTime}ms, metadata=${metadataTime}ms, processing=${processingTime}ms, save=${saveTime}ms, finalMeta=${finalMetadataTime}ms`)

      return result

    } catch (error) {
      const totalImageTime = Date.now() - imageStartTime
      console.error(`❌ [${index + 1}] Failed to process image ${image.name} after ${totalImageTime}ms:`, error)
      return null
    }
  })

  // Wait for all images to process in parallel
  const results = await Promise.all(imagePromises)
  const processedImages = results.filter((result): result is ProcessedImage => result !== null)
  
  const totalTime = Date.now() - startTime
  console.log(`🎯 Parallel image processing completed: ${processedImages.length}/${images.length} images processed in ${totalTime}ms`)

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