/**
 * Integration tests for analyze-ticket API endpoint
 */

import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequest } from 'node-mocks-http';
import { POST } from '../../app/api/analyze-ticket/route';
import { defaultQAProfile } from '../../lib/schemas/QAProfile';
import { createMinimalQACanvasDocument } from '../../lib/schemas/QACanvasDocument';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

// Mock provider failover
vi.mock('../../lib/ai/providerFailover', () => ({
  generateObjectWithFailover: vi.fn(),
  getProviderHealthStatus: vi.fn().mockReturnValue({
    openai: { status: 'healthy', lastError: null },
    anthropic: { status: 'healthy', lastError: null },
    google: { status: 'healthy', lastError: null }
  })
}));

import { generateObjectWithFailover } from '../../lib/ai/providerFailover';

describe('Analyze Ticket API', () => {
  // Sample test data
  const validTicket = {
    issueKey: 'TEST-123',
    summary: 'Test ticket',
    description: 'Test description',
    status: 'Done',
    priority: 'Priority: Normal',
    issueType: 'Bug',
    assignee: 'Test User',
    reporter: 'Test Reporter',
    comments: [
      {
        id: 'comment-1',
        author: 'John Doe',
        body: 'This is a comment',
        created: '2025-07-16T12:00:00Z',
        updated: '2025-07-16T12:01:00Z'
      }
    ],
    attachments: [],
    components: ['Frontend', 'API'],
    customFields: {
      acceptanceCriteria: 'User should be able to reset password',
      storyPoints: '5'
    },
    scrapedAt: new Date().toISOString()
  };

  const validPayload = {
    qaProfile: defaultQAProfile,
    ticketJson: validTicket
  };

  const mockQACanvasDocument = createMinimalQACanvasDocument('TEST-123', defaultQAProfile);
  mockQACanvasDocument.ticketSummary = {
    problem: 'Test problem',
    solution: 'Test solution',
    context: 'Test context'
  };
  mockQACanvasDocument.acceptanceCriteria = [
    {
      id: 'ac-1',
      title: 'Test acceptance criterion',
      description: 'Test description',
      priority: 'must',
      category: 'functional',
      testable: true
    }
  ];
  mockQACanvasDocument.testCases = [
    {
      format: 'steps',
      id: 'tc-1',
      category: 'functional',
      priority: 'high',
      estimatedTime: '5 minutes',
      testCase: {
        title: 'Test case',
        objective: 'Test description',
        preconditions: ['User is logged in'],
        steps: [
          {
            stepNumber: 1,
            action: 'Step 1',
            expectedResult: 'Result 1'
          },
          {
            stepNumber: 2,
            action: 'Step 2',
            expectedResult: 'Result 2'
          }
        ],
        postconditions: ['Test completed']
      }
    }
  ];

  beforeAll(() => {
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.OPENAI_API_KEY;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful AI response
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: mockQACanvasDocument
    });
  });

  test('should process valid ticket analysis request', async () => {
    // Create request with valid payload
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue(validPayload)
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data).toBeDefined();
    expect(data.ticketSummary).toBeDefined();
    expect(data.acceptanceCriteria).toBeInstanceOf(Array);
    expect(data.testCases).toBeInstanceOf(Array);
    expect(data.metadata).toBeDefined();
    expect(data.metadata.ticketId).toBe('TEST-123');
    
    // Verify AI function was called correctly
    expect(generateObjectWithFailover).toHaveBeenCalledWith(
      expect.any(Object), // Schema (ZodObject)
      expect.stringContaining('Analyze this Jira ticket'),
      expect.objectContaining({
        system: expect.stringContaining('QA analyst'),
        temperature: 0.3,
        maxTokens: 4000
      })
    );
  });

  test('should reject invalid request payload', async () => {
    // Create request with invalid payload
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        // Missing qaProfile
        ticketJson: {
          // Missing required fields
          summary: 'Test ticket'
        }
      })
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('Validation failed');
    expect(data.details).toBeDefined();
    expect(data.details.issues).toBeInstanceOf(Array);
    
    // AI function should not be called
    expect(generateObjectWithFailover).not.toHaveBeenCalled();
  });

  test('should handle AI processing errors', async () => {
    // Mock AI error
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI processing failed')
    );
    
    // Create request with valid payload
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue(validPayload)
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(500);
    const data = await res.json();
    
    expect(data.error).toBe('AI_PROCESSING_ERROR');
    expect(data.message).toContain('AI processing failed');
    expect(data.details).toBeDefined();
  });

  test('should handle missing API key', async () => {
    // Temporarily remove API key
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    // Mock AI function to throw configuration error
    (generateObjectWithFailover as any).mockRejectedValue(new Error('API key not configured'));
    
    // Create request with valid payload
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue(validPayload)
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(500);
    const data = await res.json();
    
    expect(data.error).toBe('CONFIGURATION_ERROR');
    expect(data.message).toContain('API key');
    
    // Restore API key
    process.env.OPENAI_API_KEY = originalKey;
  });

  test('should handle empty ticket data', async () => {
    // Mock AI response for empty data
    (generateObjectWithFailover as any).mockResolvedValue({
      object: {
        title: 'QA Documentation for EMPTY-123',
        summary: 'Generated from minimal ticket data',
        ticketSummary: {
          problem: 'Basic functionality issue',
          solution: 'Implement basic solution',
          context: 'Minimal ticket context'
        },
        configurationWarnings: [],
        acceptanceCriteria: [{
          id: '1',
          description: 'Basic functionality should work',
          priority: 'high' as const
        }],
        testCases: [{
          id: '1',
          type: 'gherkin' as const,
          title: 'Basic test case',
          priority: 'high' as const,
          tags: ['basic'],
          scenario: {
            given: 'minimal ticket data',
            when: 'processing the ticket',
            then: 'basic documentation is generated'
          }
        }],
        riskAssessment: {
          overallRisk: 'medium' as const,
          riskFactors: []
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          documentVersion: '1.0'
        }
      }
    });

    // Create request with empty ticket data
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        qaProfile: defaultQAProfile,
        ticketJson: {
          issueKey: 'EMPTY-123',
          summary: '',
          description: '',
          status: 'Done',
          issueType: 'Bug',
          priority: 'Medium',
          reporter: 'Test User',
          customFields: {},
          scrapedAt: new Date().toISOString()
        }
      })
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(200);
    
    // AI function should still be called
    expect(generateObjectWithFailover).toHaveBeenCalled();
  });

  test('should include QA profile settings in prompt', async () => {
    // Mock AI response for this test
    (generateObjectWithFailover as any).mockResolvedValue({
      object: mockQACanvasDocument
    });

    // Create request with specific QA profile settings
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        qaProfile: {
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
          testCaseFormat: 'gherkin',
          autoRefresh: true,
          includeComments: true,
          includeImages: true,
          operationMode: 'offline',
          showNotifications: true
        },
        ticketJson: validTicket
      })
    };
    
    await POST(req as any);
    
    // Verify AI function was called with QA profile settings in prompt
    expect(generateObjectWithFailover).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('gherkin'),
      expect.objectContaining({
        system: expect.stringContaining('QA analyst')
      })
    );
  });

  test('should handle rate limiting', async () => {
    // Mock rate limit error
    const rateLimitError = new Error('Rate limit exceeded');
    (rateLimitError as any).status = 429;
    (generateObjectWithFailover as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(rateLimitError);
    
    // Create request with valid payload
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue(validPayload)
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(429);
    const data = await res.json();
    
    expect(data.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(data.message).toContain('Too many requests');
  });
});