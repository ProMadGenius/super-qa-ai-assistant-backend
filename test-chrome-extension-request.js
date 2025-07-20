// Test the exact request sent from Chrome extension
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/generate-suggestions';

// Exact request from Chrome extension
const chromeExtensionRequest = {
    "currentDocument": {
        "ticketSummary": {
            "problem": "Cut-in 11536 into EnCore K2RFE SummaryAdd the following enhancements to the Buyout Process in ImagineraAdd the ability to denote an item as a Buyout Item by adding a checkbox in Spec Maintenance for production PD items on the Misc Screen.When a designated Buyout item is selected in O/P the Buyout Flag will be checked on automatically for Make and Ship and For Inventory Orders. The flag will NOT be automatically checked for Release orders.When an order is created in O/P for a non-buyout spec item (i.e. the new buyout flag is not checked on for the spec) and the Buy Out flag is checked for that specific order, no changes will be made to the new buyout flag on the spec.This new buyout logic pertains to orders created manually in Order Processing. No changes will be made to EDI order processing.If the spec is a Buyout item (F/O) the Vendor Item Cost of the primary vendor will be used instead of the spec cost.We will add a \"Buyout-Option\" in Set Order Parts in O/P – during order processing for a product structure. In addition the user will be able to specify the quantity to order. The quantity already on order will also be displayed for reference. A purchase order will automatically be created for the Buyout items during the save of the sales order. All items associated to the same primary vendor will be included as line items on the same P.O.If an item has no primary vendor it will be added to a new P.O. without a vendor. A separate P.O. will be created for each such item.A new field will be added to the product code table to handle a Buyout product code alternative. This will be triggered during the invoice creation (i.e. Post D.R. to Invoicing, Create Misc Invoice) by the spec buyout flag for product codes, in the same manner as we will trigger the Vendor Cost table access.  Certain items may be manufactured in house or another vendor. The standard product code will be stored with the spec or item, and the alternate product code will be used when the item is bought outside. Refer to the Product Code cross reference chart provided below:IfAndThenOriginally Manufactured Product CodeBuyout checked in SpecSystem changes to brokered Product CodeBrokered Product CodeBuyout un-checked in SpecSystem changes to manufactured Product CodeOriginally Brokered Product CodeBuyout checked in SpecSystem keeps Brokered product code  Open Figure 1: Buyout Flag added to Misc Screen of Spec Maintenance and also a button to launch the vendor Item maintenance screen and automatically load the current spec item.Open Figure 2: Currently the Buy Out cost is maintained in Spec Special CostsOpen Figure 3: This enhancement will allow the Buy Out cost to be maintained in Vendor Item Maintenance instead of Special Costs.Open Figure 4: The estimate above is currently displaying costs from both special costs ($495) and also standard costs ($.38 and $58.13). The result of this enhancement for Buy Out items will be to ONLY use the Vendor Item Cost ($495).*Note that if special costs are entered they will still be used…Open Figure 5: With the new logic in place the estimate above is displaying Vendor Item costs and also special costs.Open Figure 6: Example product structure item with a purchased inventory itemOpen Figure 7: Note the order itself is not a BuyoutOpen Figure 8: Note the product structure set component is a BuyoutOpen Figure 9: Validation error when attempting to designate Part 0 as BuyoutOpen Figure 10: Purchase Order created automatically in O/P for the Buyout set componentOpen Figure 11: Purchase Order created automatically in O/P for the Buyout set componentOpen Figure 12: Product Code Cross Reference TableOpen Figure 13: Product Code Table  Technical ReferencesApplication:Library: op_main.apl, op_misc.apl, spec.apl, cecalc.apl, inv_def.apl, database_changes.apl, diestat.apl, inv_main.apl, dbsqlb.sql, ord_cost.aplDatabase changes: Alter table PRODUCT_CODE add BUYOUT_PROD_CD varchar(5) null;",
            "solution": "Analysis and testing to be defined based on requirements",
            "context": "Ticket EN-9423 - Story with priority Priority: Normal"
        },
        "configurationWarnings": [
            {
                "type": "category_mismatch",
                "title": "Limited Test Categories",
                "message": "Only  testing categories are enabled",
                "recommendation": "Consider enabling more test categories for comprehensive coverage",
                "severity": "medium"
            }
        ],
        "acceptanceCriteria": [
            {
                "id": "ac-1",
                "title": "Spec Maintenance Buyout checkbox",
                "description": "A 'Buyout Item' checkbox must be present on the Misc screen in Spec Maintenance for production PD items. Checking it marks the spec as Buyout and must persist after save and reload.",
                "priority": "must",
                "category": "functional",
                "testable": true
            },
            {
                "id": "ac-2",
                "title": "Order Processing auto-check logic",
                "description": "When a Buyout spec is added to a Make & Ship or Inventory order in Order Processing, the line-level Buyout flag must auto-check. For Release orders, no auto-check occurs.",
                "priority": "must",
                "category": "functional",
                "testable": true
            },
            {
                "id": "ac-3",
                "title": "Use Vendor Item Cost for Buyout specs",
                "description": "If a spec is marked as Buyout, the system must use the primary vendor's item cost from Vendor Item Maintenance instead of the spec's standard cost, while still including any special costs.",
                "priority": "must",
                "category": "functional",
                "testable": true
            },
            {
                "id": "ac-4",
                "title": "Automatic Purchase Order creation",
                "description": "On saving a sales order containing Buyout items, the system must generate POs automatically: aggregating all lines by primary vendor into one PO, and creating separate POs for items with no primary vendor.",
                "priority": "must",
                "category": "functional",
                "testable": true
            },
            {
                "id": "ac-5",
                "title": "PRODUCT_CODE BUYOUT_PROD_CD mapping",
                "description": "Add a nullable BUYOUT_PROD_CD column to PRODUCT_CODE. On invoice creation for a Buyout spec, the invoice product code must swap from PROD_CD to BUYOUT_PROD_CD per the cross-reference rules.",
                "priority": "must",
                "category": "database",
                "testable": true
            }
        ],
        "testCases": [
            {
                "format": "gherkin",
                "id": "tc-1",
                "category": "functional",
                "priority": "high",
                "testCase": {
                    "scenario": "Mark a Spec Item as Buyout",
                    "given": [
                        "Given the user is logged into Spec Maintenance",
                        "And spec '13H063' is loaded on the Misc screen"
                    ],
                    "when": [
                        "When the user checks the 'Buyout Item' checkbox",
                        "And clicks Save"
                    ],
                    "then": [
                        "Then the 'Buyout Item' checkbox remains checked after reload",
                        "And the 'Vendor Item Maintenance' button launches with the current spec loaded (see image-20250711-011851.png)"
                    ],
                    "tags": [
                        "@functional",
                        "@ui",
                        "@image1"
                    ]
                }
            },
            {
                "format": "gherkin",
                "id": "tc-2",
                "category": "functional",
                "priority": "high",
                "testCase": {
                    "scenario": "Auto-check Buyout Flag in Order Processing",
                    "given": [
                        "Given an Order Processing session",
                        "And Order Type is 'Make and Ship'",
                        "And spec '13H063' is marked as Buyout"
                    ],
                    "when": [
                        "When the user adds the spec item to the order"
                    ],
                    "then": [
                        "Then the 'Buyout' column is automatically checked for the line item"
                    ],
                    "tags": [
                        "@functional",
                        "@image6"
                    ]
                }
            },
            {
                "format": "gherkin",
                "id": "tc-3",
                "category": "negative",
                "priority": "medium",
                "testCase": {
                    "scenario": "Validation error when marking Part 0 as Buyout",
                    "given": [
                        "Given the 'Set Order Parts' screen for a product structure shows Part 0 (the parent component)"
                    ],
                    "when": [
                        "When the user attempts to check the 'Buyout' checkbox for Part 0"
                    ],
                    "then": [
                        "Then a validation error message is displayed preventing Part 0 from being designated as Buyout (see image-20250319-150043.png)"
                    ],
                    "tags": [
                        "@negative",
                        "@validation",
                        "@image9"
                    ]
                }
            },
            {
                "format": "gherkin",
                "id": "tc-4",
                "category": "database",
                "priority": "medium",
                "testCase": {
                    "scenario": "Swap to BUYOUT_PROD_CD on invoice creation",
                    "given": [
                        "Given PRODUCT_CODE table has a record with PROD_CD='013' and BUYOUT_PROD_CD='113'",
                        "And spec '13H063' is marked as Buyout"
                    ],
                    "when": [
                        "When a Misc Invoice is created for that spec"
                    ],
                    "then": [
                        "Then the invoice uses product code '113' (BUYOUT_PROD_CD)",
                        "And no longer uses the original PROD_CD value"
                    ],
                    "tags": [
                        "@database"
                    ]
                }
            }
        ],
        "metadata": {
            "ticketId": "EN-9423",
            "qaProfile": {
                "qaCategories": {
                    "functional": true,
                    "ux": false,
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
                "includeImages": true,
                "operationMode": "online",
                "showNotifications": true
            },
            "generatedAt": "2025-07-20T03:18:40.755Z",
            "documentVersion": "1.0",
            "aiModel": "gpt-4o-mini",
            "generationTime": 0,
            "wordCount": 5387
        }
    },
    "maxSuggestions": 5,
    "focusAreas": [
        "functional_test",
        "ui_verification",
        "negative_test",
        "database_test",
        "clarification_question"
    ],
    "excludeTypes": [
        "api_test",
        "performance_test",
        "security_test",
        "edge_case",
        "integration_test",
        "accessibility_test"
    ],
    "requestId": "req-1752981520755"
};

async function testChromeExtensionRequest() {
    console.log('🧪 Testing Chrome Extension Request');
    console.log('📊 Request details:');
    console.log(`   - Ticket ID: ${chromeExtensionRequest.currentDocument.metadata.ticketId}`);
    console.log(`   - Max Suggestions: ${chromeExtensionRequest.maxSuggestions}`);
    console.log(`   - Focus Areas: ${chromeExtensionRequest.focusAreas.join(', ')}`);
    console.log(`   - Exclude Types: ${chromeExtensionRequest.excludeTypes.join(', ')}`);
    console.log(`   - Acceptance Criteria: ${chromeExtensionRequest.currentDocument.acceptanceCriteria.length}`);
    console.log(`   - Test Cases: ${chromeExtensionRequest.currentDocument.testCases.length}`);
    
    try {
        console.log('\n🚀 Sending request...');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chromeExtensionRequest),
        });

        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ SUCCESS! Suggestions generated:');
            console.log(`   📊 Total suggestions: ${data.suggestions?.length || 0}`);
            console.log(`   🕒 Generated at: ${data.generatedAt}`);
            console.log(`   📝 Context: ${data.contextSummary}`);
            
            if (data.suggestions && data.suggestions.length > 0) {
                console.log('\n🎯 Generated suggestions:');
                data.suggestions.forEach((suggestion, index) => {
                    console.log(`   ${index + 1}. ${suggestion.title}`);
                    console.log(`      Type: ${suggestion.suggestionType}`);
                    console.log(`      Priority: ${suggestion.priority}`);
                    console.log(`      Target: ${suggestion.targetSection}`);
                    console.log(`      Description: ${suggestion.description.substring(0, 100)}...`);
                    console.log('');
                });
            }
        } else {
            const errorData = await response.json();
            console.log('❌ REQUEST FAILED:');
            console.log(`   Error: ${errorData.error}`);
            console.log(`   Message: ${errorData.message}`);
            console.log(`   Details: ${errorData.details}`);
            if (errorData.suggestions) {
                console.log('   Suggestions:');
                errorData.suggestions.forEach(suggestion => {
                    console.log(`   - ${suggestion}`);
                });
            }
        }
    } catch (error) {
        console.log(`❌ Network error: ${error.message}`);
    }
}

testChromeExtensionRequest();