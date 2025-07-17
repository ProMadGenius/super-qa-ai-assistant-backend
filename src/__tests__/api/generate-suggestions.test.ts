/**
 * Integration tests for generate-suggestions API endpoint
 */

import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequest } from 'node-mocks-http';
import { POST } from '../../app/api/generate-suggestions/route';
import { defaultQAProfile } from '../../lib/schemas/QAProfile';
import { createMinimalQACanvasDocument } from '../../lib/schemas/QACanvasDocument';
import { createQASuggestion } from '../../lib/schemas/QASuggestion';

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn().mockImplementation((config) => ({
    ...config,
    _isTool: true
  }))
}));

// Mock provider failover - using the path alias that matches the API route import
vi.mock('@/lib/ai/providerFailover', () => ({
  generateTextWithFailover: vi.fn(),
  getProviderHealthStatus: vi.fn().mockReturnValue({
    openai: { name: 'openai', available: true, failureCount: 0, lastFailure: null, lastSuccess: null, circuitOpen: false, circuitOpenTime: null },
    anthropic: { name: 'anthropic', available: true, failureCount: 0, lastFailure: null, lastSuccess: null, circuitOpen: false, circuitOpenTime: null }
  })
}));

// Also mock the relative path for the import below
vi.mock('../../lib/ai/providerFailover', () => ({
  generateTextWithFailover: vi.fn(),
  getProviderHealthStatus: vi.fn().mockReturnValue({
    openai: { name: 'openai', available: true, failureCount: 0, lastFailure: null, lastSuccess: null, circuitOpen: false, circuitOpenTime: null },
    anthropic: { name: 'anthropic', available: true, failureCount: 0, lastFailure: null, lastSuccess: null, circuitOpen: false, circuitOpenTime: null }
  })
}));

// Mock error handler
vi.mock('../../lib/ai/errorHandler', () => ({
  handleAIError: vi.fn().mockImplementation((error, requestId) => {
    return new Response(JSON.stringify({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId
    }), { status: 500 });
  }),
  handleValidationError: vi.fn().mockImplementation((issues, requestId) => {
    return new Response(JSON.stringify({
      error: 'VALIDATION_ERROR',
      message: 'Validation error',
      issues,
      requestId
    }), { status: 400 });
  })
}));

// Mock uncertainty handler
vi.mock('../../lib/ai/uncertaintyHandler', () => ({
  documentAssumptions: vi.fn()
}));

// Mock UUID
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123')
}));

// Mock suggestion algorithms
vi.mock('../../lib/ai/suggestionAlgorithms', () => ({
  analyzeCoverageGaps: vi.fn().mockReturnValue({
    gaps: [],
    coveredAreas: [],
    coveragePercentage: 85
  }),
  generateClarificationQuestions: vi.fn().mockReturnValue({
    questions: []
  }),
  identifyEdgeCases: vi.fn().mockReturnValue({
    edgeCases: [
      {
        type: 'edge_case',
        scenario: 'Test edge case scenario',
        suggestion: 'Add edge case test',
        priority: 'high'
      }
    ]
  }),
  generateTestPerspectives: vi.fn().mockReturnValue([
    {
      perspective: 'ui',
      description: 'UI verification test',
      applicability: 'medium',
      implementationHint: 'Add UI test case'
    }
  ]),
  mapGapToSuggestionType: vi.fn().mockReturnValue('functional'),
  mapAmbiguityToSuggestionType: vi.fn().mockReturnValue('clarification'),
  mapEdgeCaseToSuggestionType: vi.fn().mockReturnValue('edge_case'),
  mapPerspectiveToSuggestionType: vi.fn().mockReturnValue('ui_verification')
}));

import { generateTextWithFailover } from '../../lib/ai/providerFailover';

describe('Generate Suggestions API', () => {
  // Sample test data
  const sampleDocument = createMinimalQACanvasDocument('TEST-123', defaultQAProfile);
  
  // Update sample document with more realistic data
  sampleDocument.ticketSummary = {
    problem: 'Users cannot reset their password when using special characters',
    solution: 'Update password reset functionality to handle special characters correctly',
    context: 'The password reset feature is critical for user account management'
  };
  
  sampleDocument.acceptanceCriteria = [
    {
      id: 'ac-1',
      title: 'Password reset with special characters',
      description: 'System should allow password reset with special characters',
      priority: 'must',
      category: 'functional',
      testable: true
    }
  ];
  
  sampleDocument.testCases = [
    {
      id: 'tc-1',
      category: 'functional',
      priority: 'high' as const,
      format: 'steps' as const,
      testCase: {
        title: 'Reset password with special characters',
        objective: 'Verify that users can reset passwords containing special characters',
        preconditions: ['User has valid email account'],
        steps: [
          {
            stepNumber: 1,
            action: 'Navigate to password reset page',
            expectedResult: 'Password reset page loads successfully'
          },
          {
            stepNumber: 2,
            action: 'Enter email address',
            expectedResult: 'Email field accepts input'
          },
          {
            stepNumber: 3,
            action: 'Submit reset request',
            expectedResult: 'Reset email is sent'
          },
          {
            stepNumber: 4,
            action: 'Open email and click reset link',
            expectedResult: 'Reset form opens'
          },
          {
            stepNumber: 5,
            action: 'Enter new password with special characters',
            expectedResult: 'Password field accepts special characters'
          },
          {
            stepNumber: 6,
            action: 'Confirm password reset',
            expectedResult: 'Password is successfully reset'
          }
        ],
        postconditions: ['User can login with new password']
      }
    }
  ];

  const validPayload = {
    currentDocument: sampleDocument,
    maxSuggestions: 2,
    focusAreas: ['edge_case', 'ui_verification'],
    excludeTypes: ['clarification_question']
  };

  // Sample suggestions
  const sampleSuggestions = [
    createQASuggestion({
      suggestionType: 'edge_case',
      title: 'Test password reset with extremely long passwords',
      description: 'Add a test case for passwords that are at the maximum allowed length',
      priority: 'medium',
      reasoning: 'Edge cases around password length limits are common sources of bugs',
      relatedRequirements: ['ac-1'],
      tags: ['password', 'edge-case', 'validation']
    }),
    createQASuggestion({
      suggestionType: 'ui_verification',
      title: 'Verify error message display for invalid password formats',
      description: 'Add UI verification for error message styling and placement',
      priority: 'low',
      reasoning: 'Error messages should be clearly visible and properly styled',
      relatedRequirements: ['ac-1'],
      tags: ['ui', 'error-handling', 'validation']
    })
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
    
    // Mock successful AI response with toolCalls structure that the API route expects
    (generateTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      toolCalls: [
        {
          toolName: 'qaSuggestionTool',
          args: {
            suggestionType: 'edge_case',
            title: 'Test edge case suggestion',
            description: 'This is a test edge case suggestion',
            targetSection: 'Test Cases',
            priority: 'high',
            reasoning: 'This is important for testing',
            implementationHint: 'Add this test case',
            estimatedEffort: 'medium',
            tags: ['edge-case', 'testing']
          }
        }
      ]
    });
  });

  test('should process valid suggestions request', async () => {
    // Create request with valid payload and proper json() method
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue(validPayload)
    };
    
    const res = await POST(req as any);
    
    // Debug: Log the actual response
    const data = await res.json();
    console.log('Response status:', res.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    expect(res.status).toBe(200);
    
    expect(data).toBeDefined();
    expect(data.suggestions).toBeInstanceOf(Array);
    expect(data.suggestions).toHaveLength(2);
    expect(data.suggestions[0].suggestionType).toBe('edge_case');
    expect(data.suggestions[1].suggestionType).toBe('ui_verification');
    expect(data.totalCount).toBe(2);
    expect(data.generatedAt).toBeDefined();
    
    // Verify AI function was called correctly
    expect(generateTextWithFailover).toHaveBeenCalledWith(
      expect.stringContaining('Analyze this QA documentation and generate'),
      expect.objectContaining({
        tools: expect.objectContaining({
          qaSuggestionTool: expect.any(Object)
        }),
        temperature: 0.4,
        maxTokens: 1000
      })
    );
  });

  test('should reject invalid request payload', async () => {
    // Create request with invalid payload
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        // Missing currentDocument
        maxSuggestions: 'not-a-number', // Invalid type
        focusAreas: 'not-an-array' // Invalid type
      })
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('Validation error');
    expect(data.issues).toBeDefined();
    expect(data.issues).toBeInstanceOf(Array);
    
    // AI function should not be called
    expect(generateTextWithFailover).not.toHaveBeenCalled();
  });

  test('should handle AI processing errors', async () => {
    // Mock AI error
    (generateTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI processing failed')
    );
    
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

  test('should handle invalid document JSON', async () => {
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        ...validPayload,
        currentDocument: {
          // Missing required fields to trigger validation error
          invalidField: 'test'
        }
      })
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('Validation error');
  });

  test('should respect maxSuggestions parameter', async () => {
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        ...validPayload,
        maxSuggestions: 1
      })
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    // Should only return 1 suggestion as requested
    expect(data.suggestions).toHaveLength(1);
    expect(data.totalCount).toBe(1);
  });

  test('should handle invalid AI response format', async () => {
    // Mock invalid AI response
    (generateTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('Not valid JSON');
    
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue(validPayload)
    };
    
    const res = await POST(req as any);
    
    expect(res.status).toBe(500);
    const data = await res.json();
    
    expect(data.error).toBe('AI_PROCESSING_ERROR');
    expect(data.message).toContain('Failed to parse AI response');
  });

  test('should include focus areas in prompt', async () => {
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        ...validPayload,
        focusAreas: ['security', 'performance']
      })
    };
    
    const res = await POST(req as any);
    
    // Verify AI function was called with focus areas in prompt
    expect(generateTextWithFailover).toHaveBeenCalledWith(
      expect.stringContaining('Focus on these areas: security, performance'),
      expect.any(Object)
    );
  });

  test('should exclude specified suggestion types', async () => {
    const req = {
      method: 'POST',
      json: vi.fn().mockResolvedValue({
        ...validPayload,
        excludeTypes: ['functional']
      })
    };
    
    const res = await POST(req as any);
    
    // Verify AI function was called with exclude types in prompt
    expect(generateTextWithFailover).toHaveBeenCalledWith(
      expect.stringContaining('Exclude these suggestion types: functional'),
      expect.any(Object)
    );
  });
});