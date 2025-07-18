/**
 * Test script for image upload functionality
 */

// Sample base64 image (1x1 pixel PNG)
const sampleImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=='

const testImages = [
  {
    data: sampleImage,
    mime: 'image/png',
    name: 'test-image-1.png',
    source: 'attachment'
  },
  {
    data: sampleImage,
    mime: 'image/png', 
    name: 'test-image-2.png',
    source: 'comment'
  }
]

async function testImageUpload() {
  try {
    console.log('Testing image upload...')
    
    const response = await fetch('http://localhost:3000/api/upload-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images: testImages })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('Upload successful!')
    console.log('Result:', JSON.stringify(result, null, 2))
    
    // Test if uploaded images are accessible
    for (const image of result.uploadedImages) {
      console.log(`Testing access to: http://localhost:3000${image.url}`)
    }
    
  } catch (error) {
    console.error('Upload failed:', error)
  }
}

testImageUpload()