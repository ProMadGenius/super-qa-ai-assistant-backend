import {
  qaSuggestionSchema,
  qaSuggestionsResponseSchema,
  generateSuggestionsRequestSchema,
  qaSuggestionTool,
  validateQASuggestion,
  validateQASuggestionsResponse,
  validateGenerateSuggestionsRequest,
  createQASuggestion,
  type QASuggestion,
  type QASuggestionsResponse,
  type GenerateSuggestionsRequest
} from '@/lib/schemas/QASuggestion'
import { describe, it, expect } from 'vitest'

describe('QASuggestion Schema Validation', () => {
  const validQASuggestion: QASuggestion = {
    id: 'suggestion-001',
    suggestionType: 'edge_case',
    title: 'Test payment processing with expired cards',
    description: 'Add test cases to verify proper error handling when users attempt to pay with expired credit cards',
    targetSection: 'Test Cases',
    priority: 'high',
    reasoning: 'Payment failures due to expired cards are common in production and need proper error handling',
    implementationHint: 'Create test cases with cards that expired yesterday, last month, and last year',
    relatedRequirements: ['ac-001', 'ac-003'],
    estimatedEffort: 'medium',
    tags: ['payment', 'error-handling', 'edge-case']
  }

  const validSuggestionsResponse: QASuggestionsResponse = {
    suggestions: [validQASuggestion],
    totalCount: 1,
    generatedAt: '2024-01-15T13:00:00Z',
    contextSummary: 'Payment processing feature with 3 acceptance criteria and 2 existing test cases'
  }

  const validGenerateRequest: GenerateSuggestionsRequest = {
    currentDocument: JSON.stringify({ ticketSummary: { problem: 'test' } }),
    maxSuggestions: 3,
    focusAreas: ['edge_case', 'negative_test'],
    excludeTypes: ['performance_test'],
    requestId: 'req-123'
  }

  describe('qaSuggestionSchema', () => {
    it('should validate complete valid QA suggestion', () => {
      const result = qaSuggestionSchema.safeParse(validQASuggestion)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validQASuggestion)
      }
    })

    it('should validate minimal QA suggestion with defaults', () => {
      const minimalSuggestion = {
        id: 'suggestion-002',
        suggestionType: 'functional_test' as const,
        title: 'Test basic login functionality',
        description: 'Verify that users can log in with valid credentials',
        reasoning: 'Login is a core feature that must work reliably'
      }

      const result = qaSuggestionSchema.safeParse(minimalSuggestion)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('medium')
        expect(result.data.relatedRequirements).toEqual([])
        expect(result.data.tags).toEqual([])
      }
    })

    it('should validate all suggestion types', () => {
      const suggestionTypes = [
        'edge_case', 'ui_verification', 'functional_test', 'clarification_question',
        'negative_test', 'performance_test', 'security_test', 'accessibility_test',
        'integration_test', 'data_validation'
      ]

      suggestionTypes.forEach(type => {
        const suggestion = {
          id: `suggestion-${type}`,
          suggestionType: type,
          title: `Test ${type}`,
          description: `Description for ${type}`,
          reasoning: `Reasoning for ${type}`
        }

        const result = qaSuggestionSchema.safeParse(suggestion)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid suggestion types', () => {
      const invalidSuggestion = {
        id: 'suggestion-invalid',
        suggestionType: 'invalid_type',
        title: 'Invalid suggestion',
        description: 'This should fail',
        reasoning: 'Testing validation'
      }

      const result = qaSuggestionSchema.safeParse(invalidSuggestion)
      expect(result.success).toBe(false)
    })

    it('should reject suggestion with missing required fields', () => {
      const incompleteSuggestion = {
        id: 'suggestion-incomplete',
        suggestionType: 'functional_test',
        title: 'Incomplete suggestion'
        // missing description and reasoning
      }

      const result = qaSuggestionSchema.safeParse(incompleteSuggestion)
      expect(result.success).toBe(false)
    })

    it('should validate all priority levels', () => {
      const priorities = ['high', 'medium', 'low']

      priorities.forEach(priority => {
        const suggestion = {
          id: `suggestion-${priority}`,
          suggestionType: 'functional_test' as const,
          title: `${priority} priority suggestion`,
          description: 'Test description',
          priority: priority,
          reasoning: 'Test reasoning'
        }

        const result = qaSuggestionSchema.safeParse(suggestion)
        expect(result.success).toBe(true)
      })
    })

    it('should validate all effort levels', () => {
      const effortLevels = ['low', 'medium', 'high']

      effortLevels.forEach(effort => {
        const suggestion = {
          id: `suggestion-${effort}`,
          suggestionType: 'functional_test' as const,
          title: `${effort} effort suggestion`,
          description: 'Test description',
          reasoning: 'Test reasoning',
          estimatedEffort: effort
        }

        const result = qaSuggestionSchema.safeParse(suggestion)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('qaSuggestionsResponseSchema', () => {
    it('should validate complete suggestions response', () => {
      const result = qaSuggestionsResponseSchema.safeParse(validSuggestionsResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validSuggestionsResponse)
      }
    })

    it('should validate response with multiple suggestions', () => {
      const multipleSuggestionsResponse = {
        suggestions: [
          validQASuggestion,
          {
            id: 'suggestion-002',
            suggestionType: 'ui_verification' as const,
            title: 'Verify button styling',
            description: 'Check that buttons have proper hover states',
            reasoning: 'UI consistency is important for user experience'
          }
        ],
        totalCount: 2,
        generatedAt: '2024-01-15T13:00:00Z',
        contextSummary: 'UI feature with multiple interaction points'
      }

      const result = qaSuggestionsResponseSchema.safeParse(multipleSuggestionsResponse)
      expect(result.success).toBe(true)
    })

    it('should validate response with empty suggestions array', () => {
      const emptyResponse = {
        suggestions: [],
        totalCount: 0,
        generatedAt: '2024-01-15T13:00:00Z',
        contextSummary: 'No suggestions generated for this context'
      }

      const result = qaSuggestionsResponseSchema.safeParse(emptyResponse)
      expect(result.success).toBe(true)
    })

    it('should reject response with mismatched totalCount', () => {
      const mismatchedResponse = {
        suggestions: [validQASuggestion],
        totalCount: 5, // Should be 1
        generatedAt: '2024-01-15T13:00:00Z',
        contextSummary: 'Test context'
      }

      // Note: This test shows that we don't validate the count matches the array length
      // This could be a future enhancement
      const result = qaSuggestionsResponseSchema.safeParse(mismatchedResponse)
      expect(result.success).toBe(true) // Currently passes, but we could add custom validation
    })
  })

  describe('generateSuggestionsRequestSchema', () => {
    it('should validate complete generate request', () => {
      const result = generateSuggestionsRequestSchema.safeParse(validGenerateRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validGenerateRequest)
      }
    })

    it('should validate minimal request with defaults', () => {
      const minimalRequest = {
        currentDocument: JSON.stringify({ test: 'data' })
      }

      const result = generateSuggestionsRequestSchema.safeParse(minimalRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.maxSuggestions).toBe(3)
        expect(result.data.excludeTypes).toEqual([])
      }
    })

    it('should enforce maxSuggestions limits', () => {
      const tooManyRequest = {
        currentDocument: JSON.stringify({ test: 'data' }),
        maxSuggestions: 15 // Over the limit of 10
      }

      const result = generateSuggestionsRequestSchema.safeParse(tooManyRequest)
      expect(result.success).toBe(false)

      const tooFewRequest = {
        currentDocument: JSON.stringify({ test: 'data' }),
        maxSuggestions: 0 // Under the limit of 1
      }

      const result2 = generateSuggestionsRequestSchema.safeParse(tooFewRequest)
      expect(result2.success).toBe(false)
    })

    it('should validate focusAreas and excludeTypes arrays', () => {
      const requestWithArrays = {
        currentDocument: JSON.stringify({ test: 'data' }),
        focusAreas: ['edge_case', 'security_test'],
        excludeTypes: ['performance_test', 'accessibility_test']
      }

      const result = generateSuggestionsRequestSchema.safeParse(requestWithArrays)
      expect(result.success).toBe(true)
    })

    it('should reject invalid suggestion types in arrays', () => {
      const invalidRequest = {
        currentDocument: JSON.stringify({ test: 'data' }),
        focusAreas: ['invalid_type']
      }

      const result = generateSuggestionsRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('qaSuggestionTool', () => {
    it('should have correct tool structure', () => {
      expect(qaSuggestionTool.description).toBeDefined()
      expect(qaSuggestionTool.parameters).toBeDefined()
      expect(typeof qaSuggestionTool.description).toBe('string')
    })

    it('should validate tool parameters schema', () => {
      const validToolParams = {
        suggestionType: 'edge_case',
        title: 'Test edge case',
        description: 'Detailed description',
        reasoning: 'Why this is important',
        priority: 'high'
      }

      const result = qaSuggestionTool.parameters.safeParse(validToolParams)
      expect(result.success).toBe(true)
    })

    it('should apply defaults in tool parameters', () => {
      const minimalToolParams = {
        suggestionType: 'functional_test',
        title: 'Basic test',
        description: 'Basic description',
        reasoning: 'Basic reasoning'
      }

      const result = qaSuggestionTool.parameters.safeParse(minimalToolParams)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('medium')
        expect(result.data.tags).toEqual([])
      }
    })
  })

  describe('Helper Functions', () => {
    describe('validateQASuggestion', () => {
      it('should return success for valid suggestion', () => {
        const result = validateQASuggestion(validQASuggestion)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(validQASuggestion)
        }
      })

      it('should return error for invalid suggestion', () => {
        const invalidSuggestion = {
          id: 'test',
          suggestionType: 'invalid'
        }

        const result = validateQASuggestion(invalidSuggestion)
        expect(result.success).toBe(false)
      })
    })

    describe('validateQASuggestionsResponse', () => {
      it('should return success for valid response', () => {
        const result = validateQASuggestionsResponse(validSuggestionsResponse)
        expect(result.success).toBe(true)
      })

      it('should return error for invalid response', () => {
        const result = validateQASuggestionsResponse({ invalid: 'data' })
        expect(result.success).toBe(false)
      })
    })

    describe('validateGenerateSuggestionsRequest', () => {
      it('should return success for valid request', () => {
        const result = validateGenerateSuggestionsRequest(validGenerateRequest)
        expect(result.success).toBe(true)
      })

      it('should return error for invalid request', () => {
        const result = validateGenerateSuggestionsRequest({ invalid: 'data' })
        expect(result.success).toBe(false)
      })
    })

    describe('createQASuggestion', () => {
      it('should create suggestion with auto-generated ID', () => {
        const suggestionData = {
          suggestionType: 'functional_test' as const,
          title: 'Test suggestion',
          description: 'Test description',
          reasoning: 'Test reasoning',
          priority: 'medium' as const,
          relatedRequirements: [],
          tags: []
        }

        const suggestion = createQASuggestion(suggestionData)

        expect(suggestion.id).toBeDefined()
        expect(suggestion.id).toMatch(/^suggestion-\d+-[a-z0-9]+$/)
        expect(suggestion.suggestionType).toBe('functional_test')
        expect(suggestion.title).toBe('Test suggestion')
      })

      it('should create unique IDs for multiple suggestions', () => {
        const suggestionData = {
          suggestionType: 'ui_verification' as const,
          title: 'Test UI',
          description: 'Test description',
          reasoning: 'Test reasoning',
          priority: 'low' as const,
          relatedRequirements: [],
          tags: []
        }

        const suggestion1 = createQASuggestion(suggestionData)
        const suggestion2 = createQASuggestion(suggestionData)

        expect(suggestion1.id).not.toBe(suggestion2.id)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(validateQASuggestion(null).success).toBe(false)
      expect(validateQASuggestion(undefined).success).toBe(false)
      expect(validateQASuggestionsResponse(null).success).toBe(false)
      expect(validateGenerateSuggestionsRequest(null).success).toBe(false)
    })

    it('should handle empty objects', () => {
      expect(validateQASuggestion({}).success).toBe(false)
      expect(validateQASuggestionsResponse({}).success).toBe(false)
      expect(validateGenerateSuggestionsRequest({}).success).toBe(false)
    })

    it('should handle arrays instead of objects', () => {
      expect(validateQASuggestion([]).success).toBe(false)
      expect(validateQASuggestionsResponse([]).success).toBe(false)
      expect(validateGenerateSuggestionsRequest([]).success).toBe(false)
    })
  })
})