import fetch from 'node-fetch';

async function testAnalyzeTicket() {
    console.log('🔍 Testing /api/analyze-ticket endpoint...');
    
    const payload = {
        ticketJson: {
            issueKey: "PROJ-123",
            summary: "Create Login Form",
            description: "Create a login form with username and password fields. The form should validate inputs and show error messages for invalid credentials.",
            status: "To Do",
            issueType: "Story",
            priority: "Medium",
            reporter: "test.user@example.com",
            customFields: {},
            scrapedAt: new Date().toISOString()
        },
        qaProfile: {
            qaCategories: {
                functional: true,
                performance: false,
                security: true,
                usability: true,
                compatibility: false,
                accessibility: false,
                ux: true,
                ui: true,
                negative: true,
                api: false,
                database: false,
                mobile: false
            },
            testingApproach: "comprehensive",
            riskTolerance: "medium",
            automationLevel: "high",
            testCaseFormat: "gherkin",
            autoRefresh: false,
            includeComments: true,
            includeImages: false,
            operationMode: "online",
            showNotifications: true
        }
    };

    try {
        console.log('📤 Sending request...');
        const response = await fetch('http://localhost:3000/api/analyze-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        console.log(`📊 Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            return;
        }

        const result = await response.json();
        console.log('✅ Success! Response structure:');
        console.log('- Keys:', Object.keys(result));
        
        if (result.metadata) {
            console.log('- Metadata keys:', Object.keys(result.metadata));
            if (result.metadata.qaProfile) {
                console.log('- QA Profile keys:', Object.keys(result.metadata.qaProfile));
                console.log('- QA Categories:', result.metadata.qaProfile.qaCategories);
            } else {
                console.log('❌ Missing qaProfile in metadata');
            }
        } else {
            console.log('❌ Missing metadata');
        }
        
        if (result.ticketSummary) {
            console.log('- Ticket Summary:', result.ticketSummary.title);
        }
        
        if (result.testCases) {
            console.log('- Test Cases count:', result.testCases.length);
            console.log('- First test case format:', result.testCases[0]?.format);
        }
        
        console.log('\n📋 Full response preview:');
        console.log(JSON.stringify(result, null, 2).substring(0, 1000) + '...');
        
    } catch (error) {
        console.error('💥 Request failed:', error.message);
    }
}

testAnalyzeTicket();
