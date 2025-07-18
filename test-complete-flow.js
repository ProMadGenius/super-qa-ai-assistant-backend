/**
 * Complete test for the image-enabled ticket analysis flow
 */

// Sample base64 image (small test image)
const sampleImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=='

// Mock ticket data with images
const mockTicketData = {
  qaProfile: {
    testCaseFormat: "gherkin",
    qaCategories: {
      functional: true,
      ui: true,
      negative: true,
      api: false,
      database: false,
      performance: false,
      security: false,
      mobile: false,
      accessibility: false,
      ux: true
    },
    includeComments: true,
    includeImages: true, // This is key!
    autoRefresh: true,
    operationMode: "online",
    showNotifications: true
  },
  ticketJson: {
    issueKey: "TEST-123",
    summary: "Test ticket with images",
    description: "This is a test ticket that includes image attachments for UI testing",
    status: "In Progress",
    priority: "High",
    issueType: "Bug",
    assignee: "Test User",
    reporter: "QA Tester",
    components: ["UI", "Frontend"],
    customFields: {
      "Epic Link": "TEST-100",
      "Story Points": "3"
    },
    comments: [
      {
        author: "Developer",
        body: "Here's a screenshot of the issue",
        date: "2024-01-15T10:00:00Z",
        images: [
          {
            src: sampleImage,
            filename: "screenshot.png",
            alt: "Screenshot showing the bug"
          }
        ]
      }
    ],
    attachments: [
      {
        data: sampleImage,
        mime: "image/png",
        name: "mockup.png",
        size: 70,
        tooBig: false,
        url: "blob:test"
      },
      {
        data: sampleImage,
        mime: "image/jpeg",
        name: "error-state.jpg",
        size: 85,
        tooBig: false,
        url: "blob:test2"
      }
    ],
    scrapedAt: new Date().toISOString()
  }
}

async function testCompleteFlow() {
  console.log('🚀 Testing complete ticket analysis flow with images...\n')
  
  try {
    // Test 1: Upload images endpoint
    console.log('1️⃣ Testing image upload...')
    const uploadResponse = await fetch('http://localhost:3000/api/upload-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        images: [
          {
            data: sampleImage,
            mime: 'image/png',
            name: 'test-upload.png',
            source: 'attachment'
          }
        ]
      })
    })
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json()
      console.log('✅ Image upload successful!')
      console.log(`   Uploaded ${uploadResult.count} image(s)`)
    } else {
      console.log('❌ Image upload failed:', uploadResponse.status)
    }
    
    // Test 2: Analyze ticket with images
    console.log('\n2️⃣ Testing ticket analysis with images...')
    const analyzeResponse = await fetch('http://localhost:3000/api/analyze-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockTicketData)
    })
    
    if (analyzeResponse.ok) {
      const analysisResult = await analyzeResponse.json()
      console.log('✅ Ticket analysis successful!')
      console.log(`   Generated ${analysisResult.testCases?.length || 0} test cases`)
      console.log(`   Generated ${analysisResult.acceptanceCriteria?.length || 0} acceptance criteria`)
      console.log(`   Images processed: ${analysisResult.metadata?.imagesProcessed || 0}`)
      
      // Show a sample test case
      if (analysisResult.testCases && analysisResult.testCases.length > 0) {
        console.log('\n📋 Sample test case:')
        const firstTestCase = analysisResult.testCases[0]
        console.log(`   ID: ${firstTestCase.id}`)
        console.log(`   Category: ${firstTestCase.category}`)
        console.log(`   Priority: ${firstTestCase.priority}`)
        if (firstTestCase.testCase.scenario) {
          console.log(`   Scenario: ${firstTestCase.testCase.scenario}`)
        }
      }
    } else {
      const errorResult = await analyzeResponse.json()
      console.log('❌ Ticket analysis failed:', analyzeResponse.status)
      console.log('   Error:', errorResult.message || errorResult.error)
    }
    
    console.log('\n🎉 Test completed!')
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
  }
}

// Run the test
testCompleteFlow()