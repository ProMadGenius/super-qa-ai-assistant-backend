// Test to verify Intent Analysis appears in Helicone logs
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/generate-suggestions';

// Simple request to trigger intent analysis
const testRequest = {
    "currentDocument": {
        "ticketSummary": {
            "problem": "Test problem for intent analysis",
            "solution": "Test solution",
            "context": "Testing Helicone logging"
        },
        "configurationWarnings": [],
        "acceptanceCriteria": [
            {
                "id": "ac-1",
                "title": "Test criteria",
                "description": "Test description",
                "priority": "must",
                "category": "functional",
                "testable": true
            }
        ],
        "testCases": [],
        "metadata": {
            "ticketId": "HELICONE-TEST",
            "qaProfile": {
                "qaCategories": {
                    "functional": true
                },
                "testCaseFormat": "gherkin"
            },
            "generatedAt": new Date().toISOString(),
            "documentVersion": "1.0"
        }
    },
    "maxSuggestions": 1,
    "focusAreas": ["functional_test"],
    "excludeTypes": [],
    "requestId": "helicone-test-" + Date.now(),
    // Add user context to trigger intent analysis
    "userContext": "Los criterios necesitan mejoras urgentes",
    "conversationHistory": [
        {
            "role": "user",
            "content": "Los criterios necesitan mejoras urgentes",
            "timestamp": new Date().toISOString()
        }
    ]
};

async function testIntentHelicone() {
    console.log('🔍 Testing Intent Analysis with Helicone Logging');
    console.log('📝 User Context:', testRequest.userContext);
    console.log('🎯 This should trigger Intent Analysis and appear in Helicone logs');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testRequest),
        });

        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ SUCCESS! Request completed');
            console.log(`📊 Suggestions: ${data.suggestions?.length || 0}`);
            console.log('\n🔍 Check Helicone dashboard for:');
            console.log('   1. Intent Analysis calls (should show intentClassification tool)');
            console.log('   2. Section Target Detection calls (should show sectionTargetDetection tool)');
            console.log('   3. Suggestion Generation calls (should show qaSuggestionTool)');
            console.log('\n🌐 Helicone Dashboard: https://helicone.ai/dashboard');
        } else {
            const errorData = await response.json();
            console.log('❌ REQUEST FAILED:');
            console.log(`   Error: ${errorData.error}`);
            console.log(`   Message: ${errorData.message}`);
        }
    } catch (error) {
        console.log(`❌ Network error: ${error.message}`);
    }
}

testIntentHelicone();