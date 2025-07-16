import { POST } from '@/app/api/generate-suggestions/route'
import { NextRequest } from 'next/server'
import { QACanvasDocument } from '@/lib/schemas/QACanvasDocument'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'

// Mock the AI SDK to avoid making real API calls during testing
jest.mock('ai', () => ({
  generateText: jest.fn(),
  tool: jest.fn((config) => ({
    description: config.description,
    parameters: config.parameters
  }))
}))

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mocked-openai-model')
}))

describe('/api/generate-suggestions', () => {
  const mockGenerateText = require('ai').generateText as jest.MockedFunction<any>

  const mockDocument: QACanvasDocument = {
    ticketSummary: {
      problem: 'Login button not working on mobile devices',
      solution: 'Fix button click handler and improve error handling',
      context: 'Mobile application with authentication system'
    },
    configurationWarnings: [
      {
        type: 'category_mismatch',
        title: 'Mobile Testing Recommended',
        message: 'This ticket affects mobile functionality',
        recommendation: 'Enable mobile testing category',
        severity: 'medium'
      }
    ],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Login button works on mobile',
        description: 'User can successfully click login button on mobile devices',
        priority: 'must',
        category: 'functional',
        testable: true
      },
      {
        id: 'ac-2',
        title: 'Error handling works',
        description: 'System displays appropriate error messages',
        priority: 'must',
        category: 'functional',
        testable: true
      }
    ],
    testCases: [
      {
        format: 'gherkin',
        id: 'tc-1',
        category: 'functional',
        priority: 'high',
        testCase: {
          scenario: 'User logs in successfully on mobile',
          given: ['User is on mobile login page'],
          when: ['User taps login button'],
          then: ['User is logged in successfully'],
          tags: ['@mobile', '@authentication']
        }
      }
    ],
    metadata: {
      generatedAt: '2024-01-15T13:00:00Z',
      qaProfile: defaultQAProfile,
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock successful suggestion generation
    mockGenerateText.mockResolvedValue({
      text: 'Generated suggestion',
      toolCalls: [
        {
          toolName: 'qaSuggestionTool',
          args: {
            suggestionType: 'edge_case',
            title: 'Test login with poor network connectivity',
            description: 'Add test cases for login attempts with slow or intermittent network connections to ensure proper error handling and user feedback.',
            targetSection: 'Test Cases',
            priority: 'high',
            reasoning: 'Mobile users frequently experience network issues, and login failures due to connectivity problems are common user complaints.',
            implementationHint: 'Create test scenarios with simulated network delays and connection drops during the authentication process.',
            estimatedEffort: 'medium',
            tags: ['network', 'mobile', 'error-handling']
          }
        }
      ]
    })
  })

  const validPayload = {
    currentDocument: mockDocument,
    maxSuggestions: 3,
    focusAreas: ['edge_case', 'ui_verification'],
    excludeTypes: ['performance_test'],
    requestId: 'req-123'
  }

  describe('POST /api/generate-suggestions', () => {
    it('should generate suggestions successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.suggestions).toBeDefined()
      expect(responseData.suggestions.length).toBeGreaterThan(0)
      expect(responseData.totalCount).toBe(responseData.suggestions.length)
      expect(responseData.generatedAt).toBeDefined()
      expect(responseData.contextSummary).toContain('TEST-123')
    })

    it('should validate suggestion structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)

      const suggestion = responseData.suggestions[0]
      expect(suggestion.id).toBeDefined()
      expect(suggestion.suggestionType).toBe('edge_case')
      expect(suggestion.title).toBe('Test login with poor network connectivity')
      expect(suggestion.description).toContain('network connections')
      expect(suggestion.priority).toBe('high')
      expect(suggestion.reasoning).toContain('Mobile users')
      expect(suggestion.tags).toContain('network')
    })

    it('should handle request without optional fields', async () => {
      const minimalPayload = {
        currentDocument: mockDocument
      }

      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(minimalPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-openai-model',
          temperature: 0.4
        })
      )
    })

    it('should include document context in prompt', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      const promptCall = mockGenerateText.mock.calls[0][0]
      expect(promptCall.prompt).toContain('TEST-123')
      expect(promptCall.prompt).toContain('Login button not working')
      expect(promptCall.prompt).toContain('Focus on these areas: edge_case, ui_verification')
      expect(promptCall.prompt).toContain('Exclude these types: performance_test')
      expect(promptCall.prompt).toContain('CURRENT TEST CASES (1 total)')
    })

    it('should return validation error for invalid payload', async () => {
      const invalidPayload = {
        currentDocument: {
          // Missing required fields
          ticketSummary: {}
        },
        maxSuggestions: 15 // Exceeds maximum
      }

      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)

      const responseData = await response.json()
      expect(responseData.error).toBe('VALIDATION_ERROR')
      expect(responseData.message).toContain('Invalid request payload')
    })

    it('should handle AI generation failures gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(500)

      const responseData = await response.json()
      expect(responseData.error).toBe('AI_GENERATION_ERROR')
    })

    it('should handle partial suggestion generation failures', async () => {
      // Mock first call to succeed, second to fail, third to succeed
      mockGenerateText
        .mockResolvedValueOnce({
          text: 'Success 1',
          toolCalls: [{
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'edge_case',
              title: 'First suggestion',
              description: 'First successful suggestion',
              priority: 'medium',
              reasoning: 'Important for coverage'
            }
          }]
        })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          text: 'Success 2',
          toolCalls: [{
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'ui_verification',
              title: 'Third suggestion',
              description: 'Third successful suggestion',
              priority: 'low',
              reasoning: 'Good to have'
            }
          }]
        })

      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.suggestions.length).toBe(2) // 2 successful out of 3 attempts
      expect(responseData.totalCount).toBe(2)
    })

    it('should return error when no suggestions are generated', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'No tool calls',
        toolCalls: [] // Empty tool calls
      })

      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)

      expect(response.status).toBe(500)

      const responseData = await response.json()
      expect(responseData.error).toBe('AI_GENERATION_ERROR')
      expect(responseData.message).toContain('Failed to generate any suggestions')
    })

    it('should use correct AI model and parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-openai-model',
          temperature: 0.4,
          maxTokens: 1000,
          tools: expect.objectContaining({
            qaSuggestionTool: expect.any(Object)
          })
        })
      )
    })

    it('should generate unique suggestions for multiple calls', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify({ ...validPayload, maxSuggestions: 2 })
      })

      await POST(request)

      expect(mockGenerateText).toHaveBeenCalledTimes(2)

      // Check that each call has unique prompt content
      const firstCall = mockGenerateText.mock.calls[0][0]
      const secondCall = mockGenerateText.mock.calls[1][0]

      expect(firstCall.prompt).toContain('suggestion 1 of 2')
      expect(secondCall.prompt).toContain('suggestion 2 of 2')
    })

    it('should build appropriate context summary', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(responseData.contextSummary).toContain('TEST-123')
      expect(responseData.contextSummary).toContain('2 acceptance criteria')
      expect(responseData.contextSummary).toContain('1 test cases')
      expect(responseData.contextSummary).toContain('1 configuration warnings')
    })

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should respect maxSuggestions limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify({ ...validPayload, maxSuggestions: 1 })
      })

      await POST(request)

      expect(mockGenerateText).toHaveBeenCalledTimes(1)
    })

    it('should build system prompt for QA expertise', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-suggestions', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      })

      await POST(request)

      const systemPrompt = mockGenerateText.mock.calls[0][0].system
      expect(systemPrompt).toContain('senior QA analyst')
      expect(systemPrompt).toContain('Test Coverage Analysis')
      expect(systemPrompt).toContain('qaSuggestionTool')
      expect(systemPrompt).toContain('Edge Cases')
      expect(systemPrompt).toContain('Security Tests')
    })
  })
})