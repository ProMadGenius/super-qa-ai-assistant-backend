/**
 * Integration tests for update-canvas API endpoint
 */

import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/update-canvas/route';
import { defaultQAProfile } from '../../lib/schemas/QAProfile';
import { createMinimalQACanvasDocument } from '../../lib/schemas/QACanvasDocument';

// Mock AI SDK
vi.mock('ai', () => ({
  streamText: vi.fn()
}));

// Mock provider failover
vi.mock('../../lib/ai/providerFailover', () => ({
  streamTextWithFailover: vi.fn(),
  getProviderHealthStatus: vi.fn().mockReturnValue({
    openai: { available: true, circuitOpen: false, lastError: null },
    anthropic: { available: true, circuitOpen: false, lastError: null }
  })
}));

// Mock message transformer
vi.mock('../../lib/ai/messageTransformer', () => ({
  transformMessagesForAI: vi.fn(),
  buildEnhancedSystemMessage: vi.fn().mockReturnValue({
    role: 'system',
    content: 'You are a QA assistant'
  }),
  buildContextAwarePrompt: vi.fn().mockReturnValue('You are a QA assistant'),
  extractConversationIntent: vi.fn().mockReturnValue({
    intent: 'add_content',
    confidence: 0.8,
    details: 'User wants to add new content'
  }),
  sanitizeMessagesForAI: vi.fn().mockImplementation((messages) => messages)
}));

import {
  buildContextAwarePrompt,
  extractConversationIntent,
  sanitizeMessagesForAI
} from '../../lib/ai/messageTransformer';

import { streamTextWithFailover } from '../../lib/ai/providerFailover';

describe('Update Canvas API', () => {
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
      format: 'steps',
      id: 'tc-1',
      category: 'functional',
      priority: 'high',
      testCase: {
        title: 'Reset password with special characters',
        objective: 'Verify that users can reset passwords containing special characters',
        preconditions: ['User has a valid account'],
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
            expectedResult: 'Reset password form opens'
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

  const validMessages = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Can you add more test cases for the login functionality?',
      createdAt: '2025-07-16T12:00:00Z'
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I can help you add more test cases. What specific aspects of login would you like to cover?',
      createdAt: '2025-07-16T12:01:00Z'
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'Let\'s focus on error handling and edge cases.',
      createdAt: '2025-07-16T12:02:00Z'
    }
  ];

  const validPayload = {
    messages: validMessages,
    currentDocument: JSON.stringify(sampleDocument)
  };

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

    // Mock successful streamTextWithFailover response
    (streamTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      toDataStreamResponse: vi.fn().mockReturnValue(new Response('test stream', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      }))
    });
  });

  test('should process valid update canvas request', async () => {
    // Create request with valid payload
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: validMessages,
        currentDocument: sampleDocument
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');

    // Verify streamTextWithFailover was called with correct parameters
    expect(streamTextWithFailover).toHaveBeenCalledWith(
      expect.any(String), // system prompt
      expect.objectContaining({
        messages: expect.any(Array),
        temperature: 0.3,
        maxTokens: 4000
      })
    );

    // Verify message transformer functions were called
    expect(sanitizeMessagesForAI).toHaveBeenCalledWith(validMessages);
    expect(extractConversationIntent).toHaveBeenCalledWith(validMessages);
    expect(buildContextAwarePrompt).toHaveBeenCalled();
  });

  test('should reject invalid request payload', async () => {
    // Create request with invalid payload
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        // Missing messages
        currentDocument: 'not-valid-json'
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();

    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('Validation failed');
    expect(data.details).toBeDefined();

    // AI function should not be called
    expect(streamTextWithFailover).not.toHaveBeenCalled();
  });

  test('should handle AI processing errors', async () => {
    // Mock AI error
    (streamTextWithFailover as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI processing failed')
    );

    // Create request with valid payload
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: validMessages,
        currentDocument: sampleDocument
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(500);
    const data = await res.json();

    expect(data.error).toBe('AI_PROCESSING_ERROR');
    expect(data.message).toBeDefined();
  });

  test('should handle missing API key', async () => {
    // Temporarily remove API key
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Create request with valid payload
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify(validPayload)
    });

    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.message).toBeDefined();

    // Restore API key
    process.env.OPENAI_API_KEY = originalKey;
  });

  test('should handle invalid message format', async () => {
    // Create request with invalid message format
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            // Missing id
            role: 'user',
            content: 'Invalid message'
          }
        ],
        currentDocument: sampleDocument
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.message).toBeDefined();
  });

  test('should handle invalid document JSON', async () => {
    // Create request with invalid document JSON
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: validMessages,
        currentDocument: 'not-valid-json'
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.message).toBeDefined();
  });

  test('should handle empty messages array', async () => {
    // Create request with empty messages array
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: [],
        currentDocument: sampleDocument
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.message).toBeDefined();
  });

  test('should include document context in system message', async () => {
    // Create request with valid payload
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: validMessages,
        currentDocument: sampleDocument
      })
    });

    await POST(req as any);

    // Verify buildContextAwarePrompt was called with document context
    expect(buildContextAwarePrompt).toHaveBeenCalledWith(
      expect.any(Array), // sanitized messages
      expect.objectContaining({
        currentDocument: expect.objectContaining({
          ticketSummary: expect.any(Object),
          acceptanceCriteria: expect.any(Array),
          testCases: expect.any(Array)
        })
      }),
      expect.any(Object) // conversation intent
    );
  });

  test('should handle optional document context', async () => {
    // Create request without document context
    const req = new NextRequest('http://localhost/api/update-canvas', {
      method: 'POST',
      body: JSON.stringify({
        messages: validMessages
        // No currentDocument
      })
    });

    const res = await POST(req as any);

    expect(res.status).toBe(200);

    // Verify buildContextAwarePrompt was called without document context
    expect(buildContextAwarePrompt).toHaveBeenCalledWith(
      expect.any(Array), // sanitized messages
      expect.objectContaining({
        currentDocument: undefined
      }),
      expect.any(Object) // conversation intent
    );
  });
});