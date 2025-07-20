// Minimal test to verify the parallel section generation is working
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/analyze-ticket';

// Minimal valid payload
const minimalPayload = {
  "qaProfile": {
    "qaCategories": {
      "functional": true,
      "ux": true,
      "ui": false,
      "negative": false,
      "api": false,
      "database": false,
      "performance": false,
      "security": false,
      "mobile": false,
      "accessibility": false
    },
    "testCaseFormat": "gherkin",
    "autoRefresh": true,
    "includeComments": true,
    "includeImages": false,
    "operationMode": "online",
    "showNotifications": true
  },
  "ticketJson": {
    "issueKey": "TEST-001",
    "summary": "Test parallel section generation",
    "description": "Testing the new parallel section generation system for improved performance.",
    "issueType": "Story",
    "priority": "Medium",
    "status": "In Progress",
    "assignee": "Test User",
    "reporter": "Test Reporter",
    "components": [],
    "customFields": {},
    "attachments": [],
    "comments": [],
    "scrapedAt": new Date().toISOString()
  }
};

async function testMinimalPayload() {
  console.log('🧪 Testing Minimal Payload for Parallel Section Generation');
  console.log('🎯 Goal: Verify the parallel generation system works with basic data');
  
  const startTime = Date.now();
  
  try {
    console.log('\n🚀 Sending minimal request...');
    console.log('📦 Payload structure:', Object.keys(minimalPayload));
    console.log('📦 QA Profile keys:', Object.keys(minimalPayload.qaProfile));
    console.log('📦 Ticket JSON keys:', Object.keys(minimalPayload.ticketJson));
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalPayload),
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`\n📡 Response status: ${response.status}`);
    console.log(`⏱️  Total time: ${totalTime}ms`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS! Parallel section generation working!');
      
      console.log(`\n📊 Results:`);
      console.log(`   - Ticket ID: ${data.metadata?.ticketId}`);
      console.log(`   - Generation time: ${data.metadata?.generationTime}ms`);
      console.log(`   - Word count: ${data.metadata?.wordCount}`);
      console.log(`   - AI Model: ${data.metadata?.aiModel}`);
      console.log(`   - Document sections: ${Object.keys(data).filter(k => k !== 'metadata').join(', ')}`);
      
      // Check if parallel generation worked
      if (data.metadata?.generationTime) {
        console.log(`\n🎯 Performance Analysis:`);
        console.log(`   - AI Generation: ${data.metadata.generationTime}ms`);
        if (data.metadata.generationTime < 10000) {
          console.log(`   - ✅ EXCELLENT: Under 10 seconds (parallel generation working!)`);
        } else if (data.metadata.generationTime < 15000) {
          console.log(`   - ⚡ GOOD: Under 15 seconds (significant improvement)`);
        } else {
          console.log(`   - ⚠️  SLOW: Over 15 seconds (may need optimization)`);
        }
      }
      
      // Verify all sections were generated
      const expectedSections = ['ticketSummary', 'acceptanceCriteria', 'testCases', 'configurationWarnings'];
      const missingSections = expectedSections.filter(section => !data[section]);
      
      if (missingSections.length === 0) {
        console.log(`   - ✅ All sections generated successfully`);
      } else {
        console.log(`   - ⚠️  Missing sections: ${missingSections.join(', ')}`);
      }
      
    } else {
      const errorData = await response.json();
      console.log('\n❌ REQUEST FAILED:');
      console.log(`   Error: ${errorData.error || 'Unknown error'}`);
      console.log(`   Message: ${errorData.message || 'No message'}`);
      console.log(`   Details:`, errorData.details || 'No details');
    }
    
  } catch (error) {
    console.error('\n💥 EXCEPTION:', error.message);
  }
}

// Run the test
testMinimalPayload().catch(console.error);
