// Test script for pure AI intent analysis
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/generate-suggestions';

// Test cases with different languages and intents
const testCases = [
  {
    name: "Spanish - Modification Request",
    userContext: "Los criterios están mal, necesitan mejoras",
    expectedIntent: "modify_canvas",
    expectedSections: ["acceptanceCriteria"]
  },
  {
    name: "English - Modification Request", 
    userContext: "The test cases are wrong and need to be fixed",
    expectedIntent: "modify_canvas",
    expectedSections: ["testCases"]
  },
  {
    name: "Mixed Language - Information Request",
    userContext: "¿What does this acceptance criteria mean?",
    expectedIntent: "provide_information",
    expectedSections: ["acceptanceCriteria"]
  },
  {
    name: "Spanish - Vague but Modification",
    userContext: "Esto está mal",
    expectedIntent: "modify_canvas",
    expectedSections: ["acceptanceCriteria"] // Should default to most common
  },
  {
    name: "English - Summary Issue",
    userContext: "The problem description is incorrect and needs updating",
    expectedIntent: "modify_canvas", 
    expectedSections: ["ticketSummary"]
  }
];

const basePayload = {
  currentDocument: {
    ticketSummary: {
      problem: 'Sample problem for testing',
      solution: 'Sample solution for testing',
      context: 'Testing context'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Sample acceptance criteria',
        description: 'Sample description',
        priority: 'must',
        category: 'functional',
        testable: true
      }
    ],
    testCases: [
      {
        format: 'gherkin',
        id: 'tc-1',
        category: 'functional',
        priority: 'high',
        testCase: {
          scenario: 'Sample test scenario',
          given: ['Sample given'],
          when: ['Sample when'],
          then: ['Sample then'],
          tags: ['@test']
        }
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      qaProfile: {
        testCaseFormat: 'gherkin',
        qaCategories: {
          functional: true,
          mobile: false,
          security: false
        }
      },
      ticketId: 'TEST-AI-INTENT',
      documentVersion: '1.0'
    }
  },
  maxSuggestions: 2,
  requestId: 'test-' + Date.now()
};

async function testPureAIIntent() {
  console.log('🧪 Testing Pure AI Intent Analysis\n');
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    console.log(`   Input: "${testCase.userContext}"`);
    console.log(`   Expected Intent: ${testCase.expectedIntent}`);
    console.log(`   Expected Sections: ${testCase.expectedSections.join(', ')}`);
    
    try {
      const payload = {
        ...basePayload,
        userContext: testCase.userContext,
        conversationHistory: [
          {
            role: 'user',
            content: testCase.userContext,
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Response received`);
        console.log(`   📊 Suggestions generated: ${data.suggestions?.length || 0}`);
        
        // The intent analysis happens internally, so we can't directly verify it
        // But we can check if suggestions were generated appropriately
        if (data.suggestions && data.suggestions.length > 0) {
          console.log(`   🎯 First suggestion: ${data.suggestions[0].title}`);
          console.log(`   📍 Target section: ${data.suggestions[0].targetSection}`);
        }
      } else {
        console.log(`   ❌ Request failed: ${response.status}`);
        const errorData = await response.json();
        console.log(`   Error: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 Pure AI Intent Analysis Testing Complete');
}

testPureAIIntent();