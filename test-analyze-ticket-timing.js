// Test analyze-ticket with detailed timing analysis
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/analyze-ticket';

// Test payload with images to see the parallel processing improvement
const testPayload = {
  "qaProfile": {
    "qaCategories": {
      "functional": true,
      "ui": true,
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
    "includeImages": true,
    "operationMode": "online",
    "showNotifications": true
  },
  "ticketJson": {
    "issueKey": "TIMING-TEST-001",
    "summary": "Test ticket for timing analysis",
    "description": "This is a test ticket to analyze the performance improvements in the analyze-ticket endpoint, specifically focusing on parallel image processing and detailed timing measurements.",
    "issueType": "Story",
    "priority": "Medium",
    "status": "In Progress",
    "assignee": "Test User",
    "reporter": "Test Reporter",
    "components": ["Testing"],
    "customFields": {
      "acceptanceCriteria": "System should process requests faster with parallel image processing"
    },
    "attachments": [
      {
        "name": "test-image-1.png",
        "mime": "image/png",
        "size": 50000,
        "tooBig": false,
        "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      },
      {
        "name": "test-image-2.jpg",
        "mime": "image/jpeg",
        "size": 75000,
        "tooBig": false,
        "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      },
      {
        "name": "test-image-3.png",
        "mime": "image/png",
        "size": 60000,
        "tooBig": false,
        "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      }
    ],
    "comments": [
      {
        "author": "Developer",
        "date": "2025-01-20",
        "body": "Starting implementation of parallel image processing to improve performance."
      },
      {
        "author": "QA Lead", 
        "date": "2025-01-20",
        "body": "Please ensure we have detailed timing measurements to track the improvements."
      }
    ]
  }
};

async function testAnalyzeTicketTiming() {
  console.log('🧪 Testing analyze-ticket with timing analysis');
  console.log('📊 Test includes:');
  console.log('   - 3 test images for parallel processing');
  console.log('   - includeImages: true');
  console.log('   - Detailed timing measurements');
  
  const testStartTime = Date.now();
  
  try {
    console.log('\n🚀 Sending request to analyze-ticket...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const testEndTime = Date.now();
    const totalClientTime = testEndTime - testStartTime;

    console.log(`📡 Response status: ${response.status}`);
    console.log(`⏱️  Total client-side time: ${totalClientTime}ms`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS! Document generated');
      console.log(`📊 Generated document stats:`);
      console.log(`   - Ticket ID: ${data.metadata?.ticketId}`);
      console.log(`   - Generation time: ${data.metadata?.generationTime}ms`);
      console.log(`   - Word count: ${data.metadata?.wordCount}`);
      console.log(`   - AI Model: ${data.metadata?.aiModel}`);
      console.log(`   - Acceptance Criteria: ${data.acceptanceCriteria?.length || 0}`);
      console.log(`   - Test Cases: ${data.testCases?.length || 0}`);
      console.log(`   - Configuration Warnings: ${data.configurationWarnings?.length || 0}`);
      
      console.log('\n🎯 Performance Analysis:');
      console.log(`   - Client total time: ${totalClientTime}ms`);
      console.log(`   - Server generation time: ${data.metadata?.generationTime || 'N/A'}ms`);
      
      if (totalClientTime < 20000) {
        console.log('   🚀 EXCELLENT: Under 20 seconds!');
      } else if (totalClientTime < 30000) {
        console.log('   ✅ GOOD: Under 30 seconds');
      } else {
        console.log('   ⚠️  SLOW: Over 30 seconds - needs optimization');
      }
      
    } else {
      const errorData = await response.json();
      console.log('\n❌ REQUEST FAILED:');
      console.log(`   Error: ${errorData.error}`);
      console.log(`   Message: ${errorData.message}`);
      console.log(`   Details: ${errorData.details}`);
    }
  } catch (error) {
    const testEndTime = Date.now();
    const totalClientTime = testEndTime - testStartTime;
    console.log(`\n❌ Network error after ${totalClientTime}ms: ${error.message}`);
  }
}

console.log('🔧 Testing analyze-ticket performance improvements...');
console.log('📈 Focus: Parallel image processing + section-based generation + detailed timing');
console.log('🎯 Goals:');
console.log('   - Reduce response time from ~30s to <15s');
console.log('   - Parallel image processing (60-70% faster)');
console.log('   - Section-based generation (50-70% faster)');
console.log('   - Detailed timing breakdown for bottleneck identification\n');

testAnalyzeTicketTiming();