// Using ES modules syntax for better compatibility
import fetch from 'node-fetch';

// URL of the endpoint (adjust according to your environment)
const API_URL = 'http://localhost:3000/api/generate-suggestions';

// Valid payload based on tests
const validPayload = {
  currentDocument: {
    ticketSummary: {
      problem: 'The login button does not work on mobile devices',
      solution: 'Fix the click handler for the button and improve error handling',
      context: 'Mobile application with authentication system'
    },
    configurationWarnings: [
      {
        type: 'category_mismatch',
        title: 'Mobile testing recommended',
        message: 'This ticket affects mobile functionality',
        recommendation: 'Enable mobile testing category',
        severity: 'medium'
      }
    ],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Login button works on mobile',
        description: 'User can successfully click the login button on mobile devices',
        priority: 'must',
        category: 'functional',
        testable: true
      },
      {
        id: 'ac-2',
        title: 'Error handling works',
        description: 'System shows appropriate error messages',
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
          scenario: 'User logs in successfully on mobile',
          given: ['User is on the mobile login page'],
          when: ['User taps the login button'],
          then: ['User is logged in successfully'],
          tags: ['@mobile', '@authentication']
        }
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      qaProfile: {
        testCaseFormat: 'gherkin',
        qaCategories: {
          functional: true,
          mobile: true,
          security: false
        }
      },
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  },
  maxSuggestions: 5,
  focusAreas: ['edge_case', 'clarification_question', 'functional_test'],
  excludeTypes: []
};

async function testGenerateSuggestions() {
  try {
    console.log('Sending request to generate-suggestions endpoint with intelligent algorithms...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validPayload),
    });

    if (response.ok) {
      console.log('Successful response (status code:', response.status, ')');
      const data = await response.json();
      console.log('Generated Suggestions:', JSON.stringify(data, null, 2));
    } else {
      console.error('Request error:', response.status);
      const errorData = await response.json();
      console.error('Error details:', JSON.stringify(errorData, null, 2));
    }
  } catch (error) {
    console.error('Error making request:', error);
  }
}

testGenerateSuggestions();