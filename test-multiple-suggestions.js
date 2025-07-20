// Test multiple suggestions generation
import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/generate-suggestions";

// Simple test request
const testRequest = {
  currentDocument: {
    ticketSummary: {
      problem: "Login button not working on mobile devices",
      solution: "Fix button click handler and improve error handling",
      context: "Mobile app with authentication system",
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: "ac-1",
        title: "Login button works on mobile",
        description:
          "User can successfully click login button on mobile devices",
        priority: "must",
        category: "functional",
        testable: true,
      },
    ],
    testCases: [
      {
        format: "gherkin",
        id: "tc-1",
        category: "functional",
        priority: "high",
        testCase: {
          scenario: "User logs in successfully on mobile",
          given: ["User is on mobile login page"],
          when: ["User taps login button"],
          then: ["User logs in successfully"],
          tags: ["@mobile", "@authentication"],
        },
      },
    ],
    metadata: {
      ticketId: "TEST-MULTI",
      qaProfile: {
        qaCategories: {
          functional: true,
          mobile: true,
          security: false,
        },
        testCaseFormat: "gherkin",
      },
      generatedAt: new Date().toISOString(),
      documentVersion: "1.0",
    },
  },
  maxSuggestions: 3, // Test with 3 suggestions
  focusAreas: ["functional_test", "ui_verification", "negative_test"],
  excludeTypes: ["performance_test"],
  requestId: "test-multi-" + Date.now(),
};

async function testMultipleSuggestions() {
  console.log("🧪 Testing Multiple Suggestions Generation");
  console.log(`📊 Requesting ${testRequest.maxSuggestions} suggestions`);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testRequest),
    });

    console.log(`📡 Response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(
        `✅ SUCCESS! Generated ${data.suggestions?.length || 0} suggestions`
      );
      console.log(
        `🎯 Expected: ${testRequest.maxSuggestions}, Got: ${
          data.suggestions?.length || 0
        }`
      );

      if (data.suggestions) {
        data.suggestions.forEach((suggestion, index) => {
          console.log(`\n${index + 1}. ${suggestion.title}`);
          console.log(`   Type: ${suggestion.suggestionType}`);
          console.log(`   Priority: ${suggestion.priority}`);
          console.log(`   Target: ${suggestion.targetSection}`);
        });
      }

      // Check if we got the expected number
      if (data.suggestions?.length === testRequest.maxSuggestions) {
        console.log("\n🎉 SUCCESS: Got expected number of suggestions!");
      } else {
        console.log(
          "\n⚠️  WARNING: Did not get expected number of suggestions"
        );
      }
    } else {
      const errorData = await response.json();
      console.log("❌ REQUEST FAILED:");
      console.log(`   Error: ${errorData.error}`);
      console.log(`   Message: ${errorData.message}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }
}

testMultipleSuggestions();
