/**
 * End-to-end tests for complete QA ChatCanvas workflow
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRequest } from 'node-mocks-http';
import { POST as analyzeTicketHandler } from '../../app/api/analyze-ticket/route';
import { POST as updateCanvasHandler } from '../../app/api/update-canvas/route';
import { POST as generateSuggestionsHandler } from '../../app/api/generate-suggestions/route';
import { defaultQAProfile } from '../../lib/schemas/QAProfile';
import { featureTicket, bugTicket, apiEnhancementTicket } from '../../../example/test-data/jira-tickets';

// Mock AI SDK
import { vi } from 'vitest';
vi.mock('../../lib/ai/providerFailover', () => ({
  generateObjectWithFailover: vi.fn(),
  generateTextWithFailover: vi.fn(),
  streamTextWithFailover: vi.fn(),
  getProviderHealthStatus: vi.fn().mockReturnValue({
    openai: {
      name: 'openai',
      available: true,
      failureCount: 0,
      lastFailure: null,
      lastSuccess: new Date(),
      circuitOpen: false,
      circuitOpenTime: null
    },
    anthropic: {
      name: 'anthropic',
      available: true,
      failureCount: 0,
      lastFailure: null,
      lastSuccess: new Date(),
      circuitOpen: false,
      circuitOpenTime: null
    }
  }),
  resetCircuitBreaker: vi.fn(),
  resetAllCircuitBreakers: vi.fn()
}));

import {
  generateObjectWithFailover,
  generateTextWithFailover,
  streamTextWithFailover
} from '../../lib/ai/providerFailover';
import { ReadableStream } from 'stream/web';

describe('End-to-End QA ChatCanvas Workflow', () => {
  // Test data
  const qaProfile = {
    ...defaultQAProfile,
    qaCategories: {
      functional: true,
      ui: true,
      ux: false,
      api: true,
      security: true,
      performance: false,
      accessibility: false,
      mobile: false,
      negative: true,
      database: false
    },
    testCaseFormat: 'gherkin'
  };

  // Add missing fields to test data to match schema requirements
  featureTicket.comments = featureTicket.comments.map(comment => ({
    ...comment,
    date: comment.created,
    images: [],
    links: []
  }));

  bugTicket.comments = bugTicket.comments.map(comment => ({
    ...comment,
    date: comment.created,
    images: [],
    links: []
  }));

  apiEnhancementTicket.comments = apiEnhancementTicket.comments.map(comment => ({
    ...comment,
    date: comment.created,
    images: [],
    links: []
  }));

  // Fix attachments to match schema requirements
  if (featureTicket.attachments) {
    // Create a new array with the correct schema format
    const transformedAttachments = featureTicket.attachments.map(attachment => ({
      data: attachment.content || 'base64-data',
      mime: attachment.mimeType || 'application/octet-stream',
      name: attachment.filename || 'attachment.file',
      size: attachment.size || 0,
      tooBig: false,
      url: 'blob:test-url'
    }));
    // @ts-ignore - Overriding with compatible format for testing
    featureTicket.attachments = transformedAttachments;
  }

  if (bugTicket.attachments) {
    // Create a new array with the correct schema format
    const transformedAttachments = bugTicket.attachments.map(attachment => ({
      data: attachment.content || 'base64-data',
      mime: attachment.mimeType || 'application/octet-stream',
      name: attachment.filename || 'attachment.file',
      size: attachment.size || 0,
      tooBig: false,
      url: 'blob:test-url'
    }));
    // @ts-ignore - Overriding with compatible format for testing
    bugTicket.attachments = transformedAttachments;
  }

  if (apiEnhancementTicket.attachments) {
    // Create a new array with the correct schema format
    const transformedAttachments = apiEnhancementTicket.attachments.map(attachment => ({
      data: attachment.content || 'base64-data',
      mime: attachment.mimeType || 'application/octet-stream',
      name: attachment.filename || 'attachment.file',
      size: attachment.size || 0,
      tooBig: false,
      url: 'blob:test-url'
    }));
    // @ts-ignore - Overriding with compatible format for testing
    apiEnhancementTicket.attachments = transformedAttachments;
  }

  // Mock document for testing
  let generatedDocument: any = null;
  let updatedDocument: any = null;
  let suggestions: any = null;

  beforeAll(() => {
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    // Step 1: Mock AI responses
    const mockDocument = {
      ticketSummary: {
        problem: 'Users cannot update their profile information after registration',
        solution: 'Implement user profile management functionality',
        context: 'Profile information includes name, email, profile picture, and notification preferences'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'View profile information',
          description: 'Users can view their current profile information',
          priority: 'must',
          category: 'functional',
          testable: true
        },
        {
          id: 'ac-2',
          title: 'Update profile information',
          description: 'Users can update their name and profile picture',
          priority: 'must',
          category: 'functional',
          testable: true
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          title: 'View profile information',
          description: 'Verify that users can view their profile information',
          steps: [
            'Given I am logged in as a user',
            'When I navigate to the profile page',
            'Then I should see my current profile information'
          ],
          expectedResult: 'User profile information is displayed correctly',
          category: 'functional',
          priority: 'high',
          automated: false,
          tags: ['profile', 'view']
        }
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        ticketId: 'FEAT-123',
        qaProfile: qaProfile,
        version: '1.0'
      }
    };

    const mockBugDocument = {
      ticketSummary: {
        problem: 'Password reset emails are not being delivered to users',
        solution: 'Fix email service configuration to ensure password reset emails are delivered',
        context: 'Issue started after the latest deployment and affects all users'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'Password reset emails are delivered',
          description: 'Password reset emails are successfully delivered to users',
          priority: 'must',
          category: 'functional',
          testable: true
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          title: 'Password reset email delivery',
          description: 'Verify that password reset emails are delivered to users',
          steps: [
            'Navigate to login page',
            'Click "Forgot Password" link',
            'Enter registered email address',
            'Submit form',
            'Check email inbox'
          ],
          expectedResult: 'Password reset email is received with reset link',
          category: 'functional',
          priority: 'high',
          automated: false,
          tags: ['password-reset', 'email']
        }
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        ticketId: 'BUG-456',
        qaProfile: defaultQAProfile,
        version: '1.0'
      }
    };

    const mockAPIDocument = {
      ticketSummary: {
        problem: 'Products API endpoint returns all products in a single response causing performance issues',
        solution: 'Implement pagination for the products API endpoint',
        context: 'The product catalog is growing and performance optimization is needed'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'API accepts pagination parameters',
          description: 'API endpoint accepts page and pageSize query parameters',
          priority: 'must',
          category: 'api',
          testable: true
        },
        {
          id: 'ac-2',
          title: 'Response includes pagination metadata',
          description: 'Response includes metadata with total count and pagination links',
          priority: 'must',
          category: 'api',
          testable: true
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          title: 'API pagination with default parameters',
          description: 'Verify that API uses default pagination when no parameters are provided',
          steps: [
            'Send GET request to /api/v1/products',
            'Verify response status code is 200',
            'Verify response contains 20 items (default page size)',
            'Verify response includes pagination metadata'
          ],
          expectedResult: 'API returns first page with default page size and pagination metadata',
          category: 'api',
          priority: 'high',
          automated: true,
          tags: ['api', 'pagination', 'default']
        }
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        ticketId: 'API-789',
        qaProfile: defaultQAProfile,
        version: '1.0'
      }
    };

    // Mock AI responses
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>)
      .mockImplementation((_schema, prompt) => {
        // Check the prompt to determine which document to return
        if (prompt.includes('FEAT-123')) {
          return Promise.resolve({ object: mockDocument });
        } else if (prompt.includes('BUG-456')) {
          return Promise.resolve({ object: mockBugDocument });
        } else if (prompt.includes('API-789')) {
          return Promise.resolve({ object: mockAPIDocument });
        } else {
          // Default response for other cases
          return Promise.resolve({
            object: {
              ticketSummary: {
                problem: 'Test problem',
                solution: 'Test solution',
                context: 'Test context'
              },
              acceptanceCriteria: [],
              testCases: [],
              metadata: {
                generatedAt: new Date().toISOString(),
                ticketId: 'TEST-123',
                qaProfile: defaultQAProfile,
                version: '1.0'
              }
            }
          });
        }
      });

    (streamTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      toDataStreamResponse: vi.fn().mockReturnValue(new Response('Updated document', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      }))
    });

    (generateTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        suggestions: [
          {
            id: 'suggestion-1',
            suggestionType: 'edge_case',
            title: 'Test with very long name input',
            description: 'Add a test case for updating the profile with a very long name to verify input validation',
            priority: 'medium',
            reasoning: 'Edge cases around input validation are common sources of bugs',
            tags: ['profile', 'validation', 'edge-case']
          }
        ]
      }),
      toolCalls: []
    });
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    // Reset mocks
    vi.resetAllMocks();
  });

  test('Feature ticket: Complete workflow from analysis to refinement to suggestions', async () => {
    // Step 1: Mock AI responses
    const mockDocument = {
      ticketSummary: {
        problem: 'Users cannot update their profile information after registration',
        solution: 'Implement user profile management functionality',
        context: 'Profile information includes name, email, profile picture, and notification preferences'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'View profile information',
          description: 'Users can view their current profile information',
          priority: 'must',
          category: 'functional',
          testable: true
        },
        {
          id: 'ac-2',
          title: 'Update profile information',
          description: 'Users can update their name and profile picture',
          priority: 'must',
          category: 'functional',
          testable: true
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          title: 'View profile information',
          description: 'Verify that users can view their profile information',
          steps: [
            'Given I am logged in as a user',
            'When I navigate to the profile page',
            'Then I should see my current profile information'
          ],
          expectedResult: 'User profile information is displayed correctly',
          category: 'functional',
          priority: 'high',
          automated: false,
          tags: ['profile', 'view']
        }
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        ticketId: 'FEAT-123',
        qaProfile: qaProfile,
        version: '1.0'
      }
    };

    const mockUpdatedDocument = {
      ...mockDocument,
      testCases: [
        ...mockDocument.testCases,
        {
          id: 'tc-2',
          title: 'Update name in profile',
          description: 'Verify that users can update their name in the profile',
          steps: [
            'Given I am logged in as a user',
            'When I navigate to the profile page',
            'And I click the edit button next to my name',
            'And I enter a new name',
            'And I click save',
            'Then my name should be updated',
            'And I should see a confirmation message'
          ],
          expectedResult: 'User name is updated and confirmation is shown',
          category: 'functional',
          priority: 'high',
          automated: false,
          tags: ['profile', 'update', 'name']
        }
      ]
    };

    const mockSuggestions = [
      {
        id: 'suggestion-1',
        suggestionType: 'edge_case',
        title: 'Test with very long name input',
        description: 'Add a test case for updating the profile with a very long name to verify input validation',
        priority: 'medium',
        reasoning: 'Edge cases around input validation are common sources of bugs',
        tags: ['profile', 'validation', 'edge-case']
      },
      {
        id: 'suggestion-2',
        suggestionType: 'negative_test',
        title: 'Test email update with invalid format',
        description: 'Add a negative test for updating email with invalid format',
        priority: 'high',
        reasoning: 'Email validation is critical for the email update feature',
        tags: ['profile', 'validation', 'email', 'negative']
      }
    ];

    // Mock AI responses
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: {
        ...mockDocument,
        configurationWarnings: []
      }
    });

    (streamTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      toDataStreamResponse: vi.fn().mockReturnValue(new Response('Updated document', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      }))
    });

    (generateTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      toolCalls: [
        {
          toolName: 'qaSuggestionTool',
          args: {
            suggestionType: 'edge_case',
            title: 'Test with very long name input',
            description: 'Add a test case for updating the profile with a very long name to verify input validation',
            targetSection: 'Test Cases',
            priority: 'medium',
            reasoning: 'Edge cases around input validation are common sources of bugs',
            implementationHint: 'Add this test case',
            estimatedEffort: 'medium',
            tags: ['profile', 'validation', 'edge-case']
          }
        },
        {
          toolName: 'qaSuggestionTool',
          args: {
            suggestionType: 'negative_test',
            title: 'Test email update with invalid format',
            description: 'Add a negative test for updating email with invalid format',
            targetSection: 'Test Cases',
            priority: 'high',
            reasoning: 'Email validation is critical for the email update feature',
            implementationHint: 'Add negative test case',
            estimatedEffort: 'low',
            tags: ['profile', 'validation', 'email', 'negative']
          }
        }
      ]
    });

    // Step 2: Analyze ticket
    const analyzePayload = {
      qaProfile,
      ticketJson: featureTicket
    };

    const analyzeReq = createRequest({
      method: 'POST',
      body: analyzePayload,
      // Add json method to mock NextRequest behavior
      json: async () => analyzePayload
    });

    const analyzeRes = await analyzeTicketHandler(analyzeReq as any);
    if (analyzeRes.status !== 200 && analyzeRes.status !== 206) {
      const errorData = await analyzeRes.json();
      console.log('Validation error:', errorData);
    }
    // Accept both 200 (OK) and 206 (Partial Content) as valid responses
    expect([200, 206]).toContain(analyzeRes.status);
    generatedDocument = await analyzeRes.json();

    // Verify document structure
    expect(generatedDocument).toBeDefined();
    expect(generatedDocument.ticketSummary).toBeDefined();
    expect(generatedDocument.acceptanceCriteria).toBeInstanceOf(Array);
    expect(generatedDocument.testCases).toBeInstanceOf(Array);
    expect(generatedDocument.metadata).toBeDefined();
    expect(generatedDocument.metadata.ticketId).toBe('FEAT-123');

    // Step 3: Update canvas with conversation
    const updatePayload = {
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please add a test case for updating the user\'s name in the profile',
          createdAt: new Date().toISOString()
        }
      ],
      currentDocument: generatedDocument
    };

    const updateReq = createRequest({
      method: 'POST',
      body: updatePayload,
      json: async () => updatePayload
    });

    // For streaming response, we'll just verify the status code
    const updateRes = await updateCanvasHandler(updateReq as any);
    expect([200, 206]).toContain(updateRes.status);

    // In a real test, we would consume the stream, but for this test we'll use the mock
    updatedDocument = mockUpdatedDocument;

    // Step 4: Generate suggestions
    const suggestionsPayload = {
      currentDocument: updatedDocument,
      maxSuggestions: 3,
      focusAreas: ['edge_case', 'negative_test']
    };

    const suggestionsReq = createRequest({
      method: 'POST',
      body: suggestionsPayload,
      json: async () => suggestionsPayload
    });

    const suggestionsRes = await generateSuggestionsHandler(suggestionsReq as any);
    expect(suggestionsRes.status).toBe(200);
    const suggestionsData = await suggestionsRes.json();

    // Verify suggestions
    expect(suggestionsData).toBeDefined();
    expect(suggestionsData.suggestions).toBeInstanceOf(Array);
    suggestions = suggestionsData.suggestions;
    expect(suggestions.length).toBeGreaterThan(0);
  });

  test('Bug ticket: Complete workflow with different QA profile', async () => {
    // Use different QA profile for bug ticket
    const bugQAProfile = {
      ...defaultQAProfile,
      qaCategories: {
        functional: true,
        ui: false,
        ux: false,
        api: false,
        security: false,
        performance: false,
        accessibility: false,
        mobile: false,
        negative: true,
        database: false
      },
      testCaseFormat: 'steps'
    };

    // Mock document for bug ticket
    const mockBugDocument = {
      ticketSummary: {
        problem: 'Password reset emails are not being delivered to users',
        solution: 'Fix email service configuration to ensure password reset emails are delivered',
        context: 'Issue started after the latest deployment and affects all users'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'Password reset emails are delivered',
          description: 'Password reset emails are successfully delivered to users',
          priority: 'must',
          category: 'functional',
          testable: true
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          title: 'Password reset email delivery',
          description: 'Verify that password reset emails are delivered to users',
          steps: [
            'Navigate to login page',
            'Click "Forgot Password" link',
            'Enter registered email address',
            'Submit form',
            'Check email inbox'
          ],
          expectedResult: 'Password reset email is received with reset link',
          category: 'functional',
          priority: 'high',
          automated: false,
          tags: ['password-reset', 'email']
        }
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        ticketId: 'BUG-456',
        qaProfile: bugQAProfile,
        version: '1.0'
      }
    };

    // Mock AI response for bug ticket
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: {
        ...mockBugDocument,
        configurationWarnings: []
      }
    });

    // Analyze bug ticket
    const analyzePayload = {
      qaProfile: bugQAProfile,
      ticketJson: bugTicket
    };

    const analyzeReq = createRequest({
      method: 'POST',
      body: analyzePayload,
      json: async () => analyzePayload
    });

    const analyzeRes = await analyzeTicketHandler(analyzeReq as any);
    // Accept both 200 (OK) and 206 (Partial Content) as valid responses
    expect([200, 206]).toContain(analyzeRes.status);
    const bugDocument = await analyzeRes.json();

    // Verify document structure
    expect(bugDocument).toBeDefined();
    expect(bugDocument.ticketSummary).toBeDefined();
    expect(bugDocument.acceptanceCriteria).toBeInstanceOf(Array);
    expect(bugDocument.testCases).toBeInstanceOf(Array);
    expect(bugDocument.metadata).toBeDefined();
    expect(bugDocument.metadata.ticketId).toBe('BUG-456');

    // Verify test case format matches QA profile
    expect(bugDocument.testCases[0].steps).toBeInstanceOf(Array);
    expect(bugDocument.testCases[0].steps[0]).not.toContain('Given');
  });

  test('API ticket: Complete workflow with API testing focus', async () => {
    // Use API-focused QA profile
    const apiQAProfile = {
      ...defaultQAProfile,
      qaCategories: {
        functional: true,
        ui: false,
        ux: false,
        api: true,
        security: false,
        performance: true,
        accessibility: false,
        mobile: false,
        negative: true,
        database: false
      },
      testCaseFormat: 'steps'
    };

    // Mock document for API ticket
    const mockAPIDocument = {
      ticketSummary: {
        problem: 'Products API endpoint returns all products in a single response causing performance issues',
        solution: 'Implement pagination for the products API endpoint',
        context: 'The product catalog is growing and performance optimization is needed'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'API accepts pagination parameters',
          description: 'API endpoint accepts page and pageSize query parameters',
          priority: 'must',
          category: 'api',
          testable: true
        },
        {
          id: 'ac-2',
          title: 'Response includes pagination metadata',
          description: 'Response includes metadata with total count and pagination links',
          priority: 'must',
          category: 'api',
          testable: true
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          title: 'API pagination with default parameters',
          description: 'Verify that API uses default pagination when no parameters are provided',
          steps: [
            'Send GET request to /api/v1/products',
            'Verify response status code is 200',
            'Verify response contains 20 items (default page size)',
            'Verify response includes pagination metadata'
          ],
          expectedResult: 'API returns first page with default page size and pagination metadata',
          category: 'api',
          priority: 'high',
          automated: true,
          tags: ['api', 'pagination', 'default']
        },
        {
          id: 'tc-2',
          title: 'API pagination with custom parameters',
          description: 'Verify that API respects custom pagination parameters',
          steps: [
            'Send GET request to /api/v1/products?page=2&pageSize=10',
            'Verify response status code is 200',
            'Verify response contains 10 items',
            'Verify response includes correct page number in metadata'
          ],
          expectedResult: 'API returns second page with 10 items and correct pagination metadata',
          category: 'api',
          priority: 'high',
          automated: true,
          tags: ['api', 'pagination', 'custom']
        }
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        ticketId: 'API-789',
        qaProfile: apiQAProfile,
        version: '1.0'
      }
    };

    // Mock AI response for API ticket
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: {
        ...mockAPIDocument,
        configurationWarnings: []
      }
    });

    // Analyze API ticket
    const analyzePayload = {
      qaProfile: apiQAProfile,
      ticketJson: apiEnhancementTicket
    };

    const analyzeReq = createRequest({
      method: 'POST',
      body: analyzePayload,
      json: async () => analyzePayload
    });

    const analyzeRes = await analyzeTicketHandler(analyzeReq as any);
    // Accept both 200 (OK) and 206 (Partial Content) as valid responses
    expect([200, 206]).toContain(analyzeRes.status);
    const apiDocument = await analyzeRes.json();

    // Verify document structure
    expect(apiDocument).toBeDefined();
    expect(apiDocument.ticketSummary).toBeDefined();
    expect(apiDocument.acceptanceCriteria).toBeInstanceOf(Array);
    expect(apiDocument.testCases).toBeInstanceOf(Array);
    expect(apiDocument.metadata).toBeDefined();
    expect(apiDocument.metadata.ticketId).toBe('API-789');

    // Verify API-focused test cases
    const apiTestCases = apiDocument.testCases.filter((tc: any) => tc.category === 'api');
    expect(apiTestCases.length).toBeGreaterThan(0);
  });

  test('Performance testing: Concurrent requests handling', async () => {
    // Clear previous mock calls
    vi.clearAllMocks();
    
    // Mock AI responses for multiple concurrent requests
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: {
        ticketSummary: {
          problem: 'Test problem',
          solution: 'Test solution',
          context: 'Test context'
        },
        acceptanceCriteria: [],
        testCases: [],
        configurationWarnings: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          ticketId: 'TEST-123',
          qaProfile: defaultQAProfile,
          version: '1.0'
        }
      }
    });

    // Create multiple concurrent requests
    const concurrentRequests = 5;
    const analyzePayload = {
      qaProfile: defaultQAProfile,
      ticketJson: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        status: 'Done',
        issueType: 'Bug',
        reporter: 'Test User',
        priority: 'Medium',
        components: [],
        customFields: {},
        comments: [],
        attachments: [],
        scrapedAt: new Date().toISOString()
      }
    };

    // Execute concurrent requests
    const promises = [];
    for (let i = 0; i < concurrentRequests; i++) {
      const analyzeReq = createRequest({
        method: 'POST',
        body: analyzePayload,
        json: async () => analyzePayload
      });
      promises.push(analyzeTicketHandler(analyzeReq as any));
    }

    // Wait for all requests to complete
    const results = await Promise.all(promises);

    // Verify all requests were successful
    for (const res of results) {
      expect([200, 206]).toContain(res.status);
    }

    // Verify AI function was called for each request
    expect(generateObjectWithFailover).toHaveBeenCalledTimes(concurrentRequests);
  });
});