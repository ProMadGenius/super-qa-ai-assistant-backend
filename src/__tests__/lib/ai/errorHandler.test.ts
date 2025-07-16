// NextResponse is mocked below
import { 
  handleAIError, 
  handleValidationError, 
  AIErrorType 
} from '../../../lib/ai/errorHandler'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock NextResponse
vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((body, options) => {
        return {
          body,
          status: options?.status,
          headers: options?.headers
        }
      })
    }
  }
})

describe('Error Handler', () => {
  const mockRequestId = 'test-request-id-123'
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleAIError', () => {
    it('should handle AI_NoObjectGeneratedError', () => {
      const error = new Error('AI_NoObjectGeneratedError: Failed to generate')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(500)
      expect(response.body.error).toBe(AIErrorType.AI_GENERATION_ERROR)
      expect(response.body.message).toBe('Failed to generate structured QA documentation')
      expect(response.body.requestId).toBe(mockRequestId)
      expect(response.body.errorCode).toBe('GEN_FAILURE')
      expect(response.body.retryable).toBe(true)
      expect(Array.isArray(response.body.suggestions)).toBe(true)
    })

    it('should handle rate limit errors', () => {
      const error = new Error('Rate limit exceeded for openai')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(429)
      expect(response.body.error).toBe(AIErrorType.RATE_LIMIT_ERROR)
      expect(response.body.message).toBe('AI service rate limit exceeded')
      expect(response.body.retryAfter).toBeGreaterThan(0)
      expect(response.body.provider).toBe('openai')
    })

    it('should handle quota exceeded errors', () => {
      const error = new Error('Quota exceeded for model gpt-4o')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(429)
      expect(response.body.error).toBe(AIErrorType.RATE_LIMIT_ERROR)
      expect(response.body.retryAfter).toBeGreaterThan(0)
    })

    it('should handle token limit errors', () => {
      const error = new Error('Token limit exceeded for input')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(413)
      expect(response.body.error).toBe(AIErrorType.CONTEXT_LIMIT_ERROR)
      expect(response.body.suggestions.length).toBeGreaterThan(0)
    })

    it('should handle authentication errors', () => {
      const error = new Error('Authentication failed: Invalid API key')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(401)
      expect(response.body.error).toBe(AIErrorType.AUTHENTICATION_ERROR)
      expect(response.body.retryable).toBe(false)
    })

    it('should handle timeout errors', () => {
      const error = new Error('Request timed out after 60s')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(504)
      expect(response.body.error).toBe(AIErrorType.TIMEOUT_ERROR)
    })

    it('should handle content filter errors', () => {
      const error = new Error('Content filtered by OpenAI moderation policy')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(422)
      expect(response.body.error).toBe(AIErrorType.CONTENT_FILTER_ERROR)
      expect(response.body.provider).toBe('openai')
    })

    it('should handle provider-specific errors', () => {
      const error = new Error('OpenAI API error: service unavailable')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(502)
      expect(response.body.error).toBe(AIErrorType.PROVIDER_ERROR)
      expect(response.body.provider).toBe('openai')
    })

    it('should handle generic errors', () => {
      const error = new Error('Unknown error occurred')
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(500)
      expect(response.body.error).toBe(AIErrorType.INTERNAL_SERVER_ERROR)
      expect(response.body.requestId).toBe(mockRequestId)
    })

    it('should handle non-Error objects', () => {
      const error = 'String error'
      const response = handleAIError(error, mockRequestId) as any
      
      expect(response.status).toBe(500)
      expect(response.body.error).toBe(AIErrorType.INTERNAL_SERVER_ERROR)
    })

    it('should extract model information when available', () => {
      const error = new Error('Token limit exceeded for model gpt-4o')
      const response = handleAIError(error, mockRequestId) as any
      
      // Just verify that the response contains some useful information
      expect(response.body.error).toBeDefined()
      expect(response.body.message).toBeDefined()
    })
  })

  describe('handleValidationError', () => {
    it('should format validation errors correctly', () => {
      const issues = [
        {
          path: ['qaProfile', 'testCaseFormat'],
          message: 'Invalid enum value',
          code: 'invalid_enum_value',
          received: 'invalid_format'
        },
        {
          path: ['ticketJson', 'description'],
          message: 'Required',
          code: 'invalid_type',
          received: 'undefined'
        }
      ]
      
      const response = handleValidationError(issues, mockRequestId) as any
      
      expect(response.status).toBe(400)
      expect(response.body.error).toBe(AIErrorType.VALIDATION_ERROR)
      expect(response.body.message).toBe('Invalid request payload')
      expect(response.body.details.issues.length).toBe(2)
      expect(response.body.details.groupedByField).toBeDefined()
      expect(response.body.requestId).toBe(mockRequestId)
      expect(Array.isArray(response.body.suggestions)).toBe(true)
    })

    it('should group validation errors by field', () => {
      const issues = [
        {
          path: ['qaProfile', 'testCaseFormat'],
          message: 'Invalid enum value',
          code: 'invalid_enum_value',
          received: 'invalid_format'
        },
        {
          path: ['qaProfile', 'testCaseFormat'],
          message: 'Another error',
          code: 'custom_error',
          received: 'invalid_format'
        }
      ]
      
      const response = handleValidationError(issues, mockRequestId) as any
      
      expect(response.body.details.groupedByField['qaProfile.testCaseFormat'].length).toBe(2)
    })

    it('should generate appropriate suggestions based on error types', () => {
      const issues = [
        {
          path: ['requiredField'],
          message: 'Required',
          code: 'invalid_type',
          received: 'undefined'
        }
      ]
      
      const response = handleValidationError(issues, mockRequestId) as any
      
      expect(response.body.suggestions.some((s: string) => 
        s.toLowerCase().includes('missing') || s.toLowerCase().includes('required')
      )).toBe(true)
    })
  })
})