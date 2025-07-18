import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * POST /api/upload-images
 * Converts base64 images to files and returns public URLs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { images } = body

    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: 'Images array is required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    const uploadedImages = []

    for (const image of images) {
      try {
        const { data, mime, name, source } = image
        
        // Validate base64 data
        if (!data || !data.startsWith('data:image/')) {
          console.warn(`Skipping invalid image: ${name}`)
          continue
        }

        // Extract base64 content and determine file extension
        const base64Data = data.split(',')[1]
        const mimeType = data.split(';')[0].split(':')[1]
        const extension = mimeType.split('/')[1]
        
        // Generate unique filename
        const uniqueId = uuidv4()
        const filename = `${uniqueId}.${extension}`
        const filepath = path.join(uploadsDir, filename)
        
        // Convert base64 to buffer and save
        const buffer = Buffer.from(base64Data, 'base64')
        await writeFile(filepath, buffer)
        
        // Create public URL
        const publicUrl = `/uploads/${filename}`
        
        uploadedImages.push({
          originalName: name,
          filename,
          url: publicUrl,
          size: buffer.length,
          mimeType,
          source: source || 'attachment'
        })
        
        console.log(`Uploaded image: ${name} -> ${filename} (${buffer.length} bytes)`)
      } catch (error) {
        console.error(`Failed to upload image ${image.name}:`, error)
        // Continue with other images
      }
    }

    return NextResponse.json(
      { 
        success: true,
        uploadedImages,
        count: uploadedImages.length
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    )

  } catch (error) {
    console.error('Error uploading images:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload images',
        details: error instanceof Error ? error.message : String(error)
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    )
  }
}