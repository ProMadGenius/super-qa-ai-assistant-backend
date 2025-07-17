/**
 * Test setup file for MSW and other global test configurations
 */

import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Define handlers for mock API responses
const handlers = [
  // Mock OpenAI API
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'mock-completion-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'o4-mini',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'This is a mock response from OpenAI'
          },
          finish_reason: 'stop',
          index: 0
        }
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    });
  }),

  // Mock Anthropic API
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'mock-message-id',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'This is a mock response from Anthropic'
        }
      ],
      model: 'claude-3-5-haiku-20241022',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    });
  }),

  // Mock streaming responses
  http.post('https://api.openai.com/v1/chat/completions', ({ request }) => {
    const url = new URL(request.url);
    const isStreaming = url.searchParams.get('stream') === 'true';

    if (isStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send multiple chunks to simulate streaming
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"role":"assistant","content":"This "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"is "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"a "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"mock "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"streaming "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"response"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new HttpResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    return HttpResponse.json({
      error: 'Streaming not enabled'
    }, { status: 400 });
  })
];

// Set up MSW server
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// Close server after all tests
afterAll(() => server.close());

// Mock environment variables
vi.mock('process', async () => {
  const actual = await vi.importActual('process') as any;
  return {
    ...actual,
    env: {
      ...actual.env,
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      AI_MODEL: 'o4-mini',
      CIRCUIT_BREAKER_THRESHOLD: '3',
      CIRCUIT_BREAKER_RESET_TIMEOUT: '1000',
      MAX_RETRIES: '2',
      RETRY_DELAY_MS: '100'
    }
  };
});

describe('Test Setup', () => {
  test('should have MSW server configured', () => {
    expect(server).toBeDefined();
  });
});