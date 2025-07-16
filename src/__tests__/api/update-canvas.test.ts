import { POST } from '@/app/api/update-canvas/route'
import { NextRequest } from 'next/server'

// Mock the AI SDK to avoid making real API calls during testing
jest.mock('ai', () => ({
  streamText: jest.fn(),
  convertToModelMessages: jest.fn()
}))

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mocked-openai-model')
}))

describe('/api/update-canvas', () => {
  const mockStreamText = require('ai').streamText as jest.MockedFunction<any>
  const mockConvertToModelMessages = require('ai').convertToModelMessages as jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful streaming response
    mockStreamText.mockResolvedValue({
      toDataStreamResponse: jest.fn(() => new Response('mocked stream', {
        headers: { 'Content-Type': 'text/plain' }
      }))
    })
    
    // Mock message conversion
    mockConvertToModelMessages.mockReturnValue([
      { role: 'user', content: 'Test message' }
    ])
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
      expect(mockConvertToModelMessages).toHaveBeenCalledWith(validPayload.messages)
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-openai-model',
          temperature: 0.3,
          maxTokens: 4000
        })
      )
    })

    it('should handle request without current document', async () => {
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
      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      const systemPrompt = mockStreamText.mock.calls[0][0].system
      expect(systemPrompt).toContain('Current Document Context')
      expect(systemPrompt).toContain('TEST-123')
      expect(systemPrompt).toContain('Login button not working')
      expect(systemPrompt).toContain('**Current Test Cases Count:** 1')
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
      const request = new NextRequest('http://localhost:3000/api/update-canvas', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      const systemPrompt = mockStreamText.mock.calls[0][0].system
      expect(systemPrompt).toContain('QA analyst assistant')
      expect(systemPrompt).toContain('refine and improve QA documentation')
      expect(systemPrompt).toContain('Be conversational and helpful')
      expect(systemPrompt).toContain('Maintain document coherence')
    })
  })
})