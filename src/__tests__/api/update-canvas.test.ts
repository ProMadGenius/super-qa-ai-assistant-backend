import { POST } from '@/app/api/update-canvas/route'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the AI SDK to avoid making real API calls during testing
vi.mock('ai', () => ({
  streamText: vi.fn()
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-openai-model')
}))

describe('/api/update-canvas', () => {
  let mockStreamText: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Get the mocked streamText function
    mockStreamText = vi.mocked((await import('ai')).streamText)

    // Mock successful streaming response with all required properties
    mockStreamText.mockResolvedValue({
      toDataStreamResponse: vi.fn(() => new Response('mocked stream', {
        headers: { 'Content-Type': 'text/plain' }
      })),
      warnings: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      sources: [],
      files: [],
      text: '',
      toolCalls: [],
      toolResults: [],
      finishReason: 'stop',
      rawResponse: {},
      response: {},
      experimental_providerMetadata: undefined
    })
  })

  const validPayload = {
    messages: [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Can you add more test cases for edge cases?',
        createdAt: '2024-01-15T13:00:00Z'
      }
    ],
    currentDocument: {
      ticketSummary: {
        problem: 'Login button not working',
        solution: 'Fix button click handler',
        context: 'Mobile application'
      },
      acceptanceCriteria: [
        {
          id: 'ac-1',
          title: 'Login works',
          description: 'User can login successfully'
        }
      ],
      testCases: [
        {
          id: 'tc-1',
          format: 'gherkin',
          testCase: {
            scenario: 'User logs in',
            given: ['User is on login page'],
            when: ['User clicks login'],
            then: ['User is logged in']
          }
        }
      ],
      metadata: {
        ticketId: 'TEST-123',
        qaProfile: { testCaseFormat: 'gherkin' },
        generatedAt: '2024-01-15T13:00:00Z'
      }
    }
  }

  describe('POST /api/update-canvas', () => {
    it('should process valid update canvas request', async () => {
      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)

      expect(response).toBeDefined()
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-openai-model',
          temperature: 0.3,
          maxTokens: 4000
        })
      )
    })

    it('should handle request without current document', async () => {
      // Mock successful streaming response with system prompt capture
      mockStreamText.mockImplementation((_options: any) => {
        return Promise.resolve({
          toDataStreamResponse: vi.fn(() => new Response('mocked stream', {
            headers: { 'Content-Type': 'text/plain' }
          })),
          warnings: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          sources: [],
          files: [],
          text: '',
          toolCalls: [],
          toolResults: [],
          finishReason: 'stop',
          rawResponse: {},
          response: {},
          experimental_providerMetadata: undefined
        })
      })

      const payloadWithoutDocument = {
        messages: [
          {
            id: 'msg-1',
            role: 'user' as const,
            content: 'Help me improve my test cases'
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(payloadWithoutDocument)
      })

      const response = await POST(request)

      expect(response).toBeDefined()
      expect(mockStreamText).toHaveBeenCalled()

      // Verify system prompt doesn't include document context
      const systemPrompt = mockStreamText.mock.calls[0][0].system
      expect(systemPrompt).not.toContain('Current Document Context')
    })

    it('should include document context in system prompt when provided', async () => {
      // Mock successful streaming response with system prompt capture
      mockStreamText.mockImplementation((_options: any) => {
        return Promise.resolve({
          toDataStreamResponse: vi.fn(() => new Response('mocked stream', {
            headers: { 'Content-Type': 'text/plain' }
          })),
          warnings: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          sources: [],
          files: [],
          text: '',
          toolCalls: [],
          toolResults: [],
          finishReason: 'stop',
          rawResponse: {},
          response: {},
          experimental_providerMetadata: undefined
        })
      })

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      // Verify the call was made with the right parameters
      expect(mockStreamText).toHaveBeenCalled()
      expect(mockStreamText.mock.calls[0][0]).toHaveProperty('system')

      const systemPrompt = mockStreamText.mock.calls[0][0].system
      expect(systemPrompt).toContain('Current Document Context')
      expect(systemPrompt).toContain('TEST-123')
      expect(systemPrompt).toContain('Login button not working')
    })

    it('should return validation error for invalid payload', async () => {
      const invalidPayload = {
        messages: [] // Empty messages array
      }

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      const responseData = await response.json()
      expect(responseData.error).toBe('VALIDATION_ERROR')
      expect(responseData.message).toContain('Invalid request payload')
    })

    it('should return validation error for messages with invalid role', async () => {
      const invalidPayload = {
        messages: [
          {
            id: 'msg-1',
            role: 'invalid_role',
            content: 'Test message'
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      const responseData = await response.json()
      expect(responseData.error).toBe('VALIDATION_ERROR')
    })

    it('should return validation error for messages without required fields', async () => {
      const invalidPayload = {
        messages: [
          {
            id: 'msg-1',
            role: 'user'
            // Missing content field
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should handle AI processing errors', async () => {
      mockStreamText.mockRejectedValue(new Error('AI processing failed'))

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(500)

      const responseData = await response.json()
      expect(responseData.error).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should use correct AI model and parameters', async () => {
      // Mock successful streaming response
      mockStreamText.mockImplementation((_options: any) => {
        return Promise.resolve({
          toDataStreamResponse: vi.fn(() => new Response('mocked stream', {
            headers: { 'Content-Type': 'text/plain' }
          })),
          warnings: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          sources: [],
          files: [],
          text: '',
          toolCalls: [],
          toolResults: [],
          finishReason: 'stop',
          rawResponse: {},
          response: {},
          experimental_providerMetadata: undefined
        })
      })

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-openai-model',
          temperature: 0.3,
          maxTokens: 4000
        })
      )
    })

    it('should build appropriate system prompt for QA refinement', async () => {
      // Mock successful streaming response with system prompt capture
      mockStreamText.mockImplementation((_options: any) => {
        return Promise.resolve({
          toDataStreamResponse: vi.fn(() => new Response('mocked stream', {
            headers: { 'Content-Type': 'text/plain' }
          })),
          warnings: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          sources: [],
          files: [],
          text: '',
          toolCalls: [],
          toolResults: [],
          finishReason: 'stop',
          rawResponse: {},
          response: {},
          experimental_providerMetadata: undefined
        })
      })

      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      // Verify the call was made with the right parameters
      expect(mockStreamText).toHaveBeenCalled()
      expect(mockStreamText.mock.calls[0][0]).toHaveProperty('system')

      const systemPrompt = mockStreamText.mock.calls[0][0].system
      expect(systemPrompt).toContain('QA analyst assistant')
      expect(systemPrompt).toContain('refine and improve QA documentation')
      expect(systemPrompt).toContain('Be conversational and helpful')
      expect(systemPrompt).toContain('Maintain document coherence')
    })
  })
})