// Test the new section-based generation system
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/analyze-ticket';

// Test payload optimized for section generation testing
const sectionTestPayload = {
  "qaProfile": {
    "qaCategories": {
      "functional": true,
      "ux": true,
      "ui": true,
      "negative": true,
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
    "includeImages": false, // Disable images to focus on section generation speed
    "operationMode": "online",
    "showNotifications": true
  },
  "ticketJson": {
    "issueKey": "SECTION-TEST-001",
    "summary": "Implement parallel section generation for faster QA document creation",
    "description": "The current monolithic approach to QA document generation takes too long. We need to implement parallel section generation where ticket summary, acceptance criteria, test cases, and configuration warnings are generated simultaneously using optimized, section-specific prompts. This should reduce generation time from 15-20 seconds to 5-8 seconds while maintaining or improving quality.",
    "issueType": "Story",
    "priority": "High",
    "status": "In Progress",
    "assignee": "QA Team",
    "reporter": "Product Owner",
    "components": ["QA Automation", "Performance"],
    "customFields": {
      "acceptanceCriteria": "System should generate QA documents 60-70% faster using parallel processing",
      "storyPoints": "8",
      "epic": "QA Performance Improvements"
    },
    "attachments": [],
    "comments": [
      {
        "author": "Tech Lead",
        "date": "2025-01-20",
        "body": "We should implement this using Promise.all() to run all section generators in parallel. Each section should have its own optimized prompt to reduce token usage and improve specificity."
      },
      {
        "author": "QA Engineer", 
        "date": "2025-01-20",
        "body": "The current approach generates everything in one massive prompt. Breaking it down will allow us to fine-tune each section's generation and handle failures more gracefully."
      },
      {
        "author": "Product Owner",
        "date": "2025-01-20",
        "body": "Performance is critical here. Users are waiting 20+ seconds for document generation. Target should be under 8 seconds total."
      }
    ],
    "scrapedAt": new Date().toISOString()
  }
};

async function testSectionGeneration() {
  console.log('🧪 Testing Section-Based Generation System');
  console.log('🎯 Focus: Parallel section generation performance');
  console.log('📊 Expected improvements:');
  console.log('   - Generation time: 15-20s → 5-8s (60-70% faster)');
  console.log('   - Better error handling: Individual section failures');
  console.log('   - Improved quality: Section-specific prompts');
  console.log('   - Token efficiency: Optimized prompts per section');
  
  const testStartTime = Date.now();
  
  try {
    console.log('\n🚀 Sending request to analyze-ticket with section generation...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sectionTestPayload),
    });

    const testEndTime = Date.now();
    const totalClientTime = testEndTime - testStartTime;

    console.log(`📡 Response status: ${response.status}`);
    console.log(`⏱️  Total client-side time: ${totalClientTime}ms`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS! Document generated with section-based approach');
      
      // Analyze the generated document structure
      console.log(`\n📊 Generated Document Analysis:`);
      console.log(`   - Ticket ID: ${data.metadata?.ticketId}`);
      console.log(`   - Generation time: ${data.metadata?.generationTime}ms`);
      console.log(`   - Word count: ${data.metadata?.wordCount}`);
      console.log(`   - AI Model: ${data.metadata?.aiModel}`);
      
      // Section-specific analysis
      console.log(`\n📋 Section Breakdown:`);
      console.log(`   - Ticket Summary: ${data.ticketSummary ? '✅' : '❌'}`);
      if (data.ticketSummary) {
        console.log(`     • Problem: ${data.ticketSummary.problem.substring(0, 100)}...`);
        console.log(`     • Solution: ${data.ticketSummary.solution.substring(0, 100)}...`);
        console.log(`     • Context: ${data.ticketSummary.context.substring(0, 100)}...`);
      }
      
      console.log(`   - Acceptance Criteria: ${data.acceptanceCriteria?.length || 0} items`);
      if (data.acceptanceCriteria && data.acceptanceCriteria.length > 0) {
        data.acceptanceCriteria.forEach((ac, index) => {
          console.log(`     ${index + 1}. ${ac.title} (${ac.priority}, ${ac.category})`);
        });
      }
      
      console.log(`   - Test Cases: ${data.testCases?.length || 0} items`);
      if (data.testCases && data.testCases.length > 0) {
        data.testCases.forEach((tc, index) => {
          console.log(`     ${index + 1}. ${tc.testCase.scenario || tc.testCase.title} (${tc.priority})`);
        });
      }
      
      console.log(`   - Configuration Warnings: ${data.configurationWarnings?.length || 0} items`);
      if (data.configurationWarnings && data.configurationWarnings.length > 0) {
        data.configurationWarnings.forEach((warning, index) => {
          console.log(`     ${index + 1}. ${warning.title} (${warning.severity})`);
        });
      }
      
      // Performance analysis
      console.log('\n🎯 Performance Analysis:');
      console.log(`   - Client total time: ${totalClientTime}ms`);
      console.log(`   - Server generation time: ${data.metadata?.generationTime || 'N/A'}ms`);
      
      // Performance benchmarks
      if (totalClientTime < 8000) {
        console.log('   🚀 EXCELLENT: Under 8 seconds! Target achieved!');
      } else if (totalClientTime < 12000) {
        console.log('   ✅ GOOD: Under 12 seconds - significant improvement');
      } else if (totalClientTime < 20000) {
        console.log('   ⚠️  MODERATE: Under 20 seconds - some improvement');
      } else {
        console.log('   ❌ SLOW: Over 20 seconds - needs more optimization');
      }
      
      // Quality analysis
      console.log('\n📈 Quality Analysis:');
      const hasAllSections = data.ticketSummary && data.acceptanceCriteria && data.testCases;
      console.log(`   - All sections generated: ${hasAllSections ? '✅' : '❌'}`);
      console.log(`   - Acceptance criteria count: ${data.acceptanceCriteria?.length || 0} (target: 3-5)`);
      console.log(`   - Test cases count: ${data.testCases?.length || 0} (target: 3-5)`);
      
      const qualityScore = (
        (hasAllSections ? 25 : 0) +
        (data.acceptanceCriteria?.length >= 3 && data.acceptanceCriteria?.length <= 5 ? 25 : 0) +
        (data.testCases?.length >= 3 && data.testCases?.length <= 5 ? 25 : 0) +
        (totalClientTime < 12000 ? 25 : totalClientTime < 20000 ? 15 : 5)
      );
      
      console.log(`   - Overall Quality Score: ${qualityScore}/100`);
      
      if (qualityScore >= 90) {
        console.log('   🏆 OUTSTANDING: Section generation working perfectly!');
      } else if (qualityScore >= 75) {
        console.log('   🎯 EXCELLENT: Section generation working well');
      } else if (qualityScore >= 60) {
        console.log('   ✅ GOOD: Section generation functional with room for improvement');
      } else {
        console.log('   ⚠️  NEEDS WORK: Section generation needs optimization');
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

console.log('🔧 Testing Section-Based QA Document Generation...');
console.log('🎯 Goals:');
console.log('   - Reduce generation time by 60-70%');
console.log('   - Maintain or improve document quality');
console.log('   - Better error handling per section');
console.log('   - Optimize token usage with specific prompts\n');

testSectionGeneration();