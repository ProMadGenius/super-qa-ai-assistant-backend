/**
 * Integration tests for enhanced /api/generate-suggestions endpoint with intent analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/generate-suggestions/route'
import { NextRequest } from 'next/server'
import type { QACanvasDocument } from '../../lib/schemas/QACanvasDocument'

// Mock the AI components
vi.mock('../../lib/ai/intent')
vi.mock('@/lib/ai/providerFailover')

describe('/api/generate-suggestions with Intent Analysis', () => {
  const mockCanvas: QACanvasDocument = {
    ticketSummary: {
      problem: 'User login fails intermittently',
      solution: 'Implement retry logic and better error handling',
      context: 'Authentication system needs improvement'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Login retry mechanism',
        description: 'System should retry failed login attempts',
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
        estimatedTime: '10 minutes',
        testCase: {
          scenario: 'User login with valid credentials',
          given: ['User has valid credentials'],
          when: ['User attempts to login'],
          then: ['User should be logged in successfully'],
          tags: ['@login', '@authentication']
        }
      }
    ],
    metadata: {
      ticketId: 'AUTH-123',
      qaProfile: {
        testCaseFormat: 'gherkin',
        qaCategories: {
          functional: true,
          security: true,
          performance: false
        }
      },
      generatedAt: new Date().toISOString()
    }
  }

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/generate-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-key'
  })

  describe('Intent-Based Suggestion Generation', () => {
    it('should generate suggestions with intent analysis when user context is provided', async () => {
      const { IntentAnalyzer, SectionTargetDetector } = await import('../../lib/ai/intent')
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      const mockAnalyzeIntent = vi.fn().mockResolvedValue({
        intent: 'modify_canvas',
        confidence: 0.9,
        targetSections: ['testCases'],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium',
          conversationLength: 1,
          availableSections: ['ticketSummary', 'acceptanceCriteria', 'testCases']
        },
        reasoning: 'User wants to improve test coverage',
        keywords: ['test', 'coverage', 'edge cases'],
        shouldModifyCanvas: true,
        requiresClarification: false
      })

      const mockDetectTargetSections = vi.fn().mockResolvedValue({
        primaryTargets: ['testCases'],
        secondaryTargets: ['acceptanceCriteria'],
        keywords: ['test', 'edge', 'negative'],
        confidence: 0.85,
        detectionMethod: 'hybrid'
      })

      vi.mocked(IntentAnalyzer).mockImplementation(() => ({
        analyzeIntent: mockAnalyzeIntent
      }) as any)

      vi.mocked(SectionTargetDetector).mockImplementation(() => ({
        detectTargetSections: mockDetectTargetSections
      }) as any)

      vi.mocked(generateTextWithFailover).mockResolvedValue({
        toolCalls: [
          {
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'edge_case',
              title: 'Test login with network timeout',
              description: 'Add test cases for network timeout scenarios during login',
              targetSection: 'testCases',
              priority: 'high',
              reasoning: 'Network issues are common cause of login failures',
              implementationHint: 'Mock network delays and timeouts',
              estimatedEffort: 'medium',
              tags: ['network', 'timeout', 'edge-case']
            }
          }
        ]
      })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 2,
        userContext: 'I need to add more edge case tests for the login functionality',
        conversationHistory: [
          {
            role: 'user',
            content: 'I need to add more edge case tests for the login functionality',
            timestamp: new Date().toISOString()
          }
        ]
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toBeDefined()
      expect(data.suggestions.length).toBeGreaterThan(0)
      expect(data.totalCount).toBe(data.suggestions.length)
      expect(data.contextSummary).toContain('AUTH-123')

      // Verify intent analysis was called
      expect(mockAnalyzeIntent).toHaveBeenCalledWith(
        'I need to add more edge case tests for the login functionality',
        expect.any(Array),
        mockCanvas
      )

      // Verify section target detection was called
      expect(mockDetectTargetSections).toHaveBeenCalledWith(
        'I need to add more edge case tests for the login functionality',
        mockCanvas
      )
    })

    it('should generate standard suggestions when no user context is provided', async () => {
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      vi.mocked(generateTextWithFailover).mockResolvedValue({
        toolCalls: [
          {
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'coverage_gap',
              title: 'Add negative test cases',
              description: 'Test login with invalid credentials',
              targetSection: 'testCases',
              priority: 'medium',
              reasoning: 'Missing negative test scenarios',
              implementationHint: 'Test with wrong username/password combinations',
              estimatedEffort: 'low',
              tags: ['negative-test', 'security']
            }
          }
        ]
      })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 1
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toBeDefined()
      expect(data.suggestions.length).toBeGreaterThan(0)
      expect(data.suggestions[0].title).toContain('negative test')
    })

    it('should handle intent analysis failures gracefully', async () => {
      const { IntentAnalyzer } = await import('../../lib/ai/intent')
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      const mockAnalyzeIntent = vi.fn().mockRejectedValue(new Error('Intent analysis failed'))

      vi.mocked(IntentAnalyzer).mockImplementation(() => ({
        analyzeIntent: mockAnalyzeIntent
      }) as any)

      vi.mocked(generateTextWithFailover).mockResolvedValue({
        toolCalls: [
          {
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'improvement',
              title: 'Improve error messages',
              description: 'Add more descriptive error messages for login failures',
              targetSection: 'acceptanceCriteria',
              priority: 'medium',
              reasoning: 'Better user experience',
              implementationHint: 'Specify exact error conditions',
              estimatedEffort: 'low',
              tags: ['ux', 'error-handling']
            }
          }
        ]
      })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 1,
        userContext: 'Improve the login process'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toBeDefined()
      expect(data.suggestions.length).toBeGreaterThan(0)
      // Should still generate suggestions despite intent analysis failure
    })

    it('should filter suggestions based on focus areas', async () => {
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      vi.mocked(generateTextWithFailover).mockResolvedValue({
        toolCalls: [
          {
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'security',
              title: 'Add security tests',
              description: 'Test for SQL injection vulnerabilities',
              targetSection: 'testCases',
              priority: 'high',
              reasoning: 'Security is critical for login functionality',
              implementationHint: 'Test with malicious SQL inputs',
              estimatedEffort: 'medium',
              tags: ['security', 'sql-injection']
            }
          }
        ]
      })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 2,
        focusAreas: ['security']
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toBeDefined()
      expect(data.suggestions.length).toBeGreaterThan(0)
      expect(data.suggestions[0].suggestionType).toBe('security')
    })

    it('should exclude specified suggestion types', async () => {
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      // Mock multiple responses to test filtering
      vi.mocked(generateTextWithFailover)
        .mockResolvedValueOnce({
          toolCalls: [
            {
              toolName: 'qaSuggestionTool',
              args: {
                suggestionType: 'performance', // This should be excluded
                title: 'Performance test',
                description: 'Test login performance',
                targetSection: 'testCases',
                priority: 'low',
                reasoning: 'Performance matters',
                implementationHint: 'Measure response times',
                estimatedEffort: 'high',
                tags: ['performance']
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          toolCalls: [
            {
              toolName: 'qaSuggestionTool',
              args: {
                suggestionType: 'functional',
                title: 'Functional test',
                description: 'Test core login functionality',
                targetSection: 'testCases',
                priority: 'high',
                reasoning: 'Core functionality must work',
                implementationHint: 'Test happy path scenarios',
                estimatedEffort: 'medium',
                tags: ['functional']
              }
            }
          ]
        })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 2,
        excludeTypes: ['performance']
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toBeDefined()
      // Should only include non-excluded suggestions
      expect(data.suggestions.every((s: any) => s.suggestionType !== 'performance')).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing API key', async () => {
      delete process.env.OPENAI_API_KEY

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 1
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('CONFIGURATION_ERROR')
      expect(data.message).toContain('API key')
    })

    it('should handle invalid request payload', async () => {
      const request = createRequest({
        currentDocument: {
          // Missing required fields
          ticketSummary: {}
        },
        maxSuggestions: 1
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should handle AI generation failures', async () => {
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      vi.mocked(generateTextWithFailover).mockRejectedValue(new Error('AI service unavailable'))

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 1
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('AI_GENERATION_ERROR')
      expect(data.retryable).toBe(true)
    })

    it('should handle no suggestions generated', async () => {
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      // Mock empty or invalid responses
      vi.mocked(generateTextWithFailover).mockResolvedValue({
        toolCalls: [] // No tool calls
      })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 1
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('AI_GENERATION_ERROR')
      expect(data.errorCode).toBe('NO_SUGGESTIONS')
      expect(data.suggestions).toBeDefined()
      expect(Array.isArray(data.suggestions)).toBe(true)
    })
  })

  describe('Response Format', () => {
    it('should return properly formatted suggestions response', async () => {
      const { generateTextWithFailover } = await import('@/lib/ai/providerFailover')

      vi.mocked(generateTextWithFailover).mockResolvedValue({
        toolCalls: [
          {
            toolName: 'qaSuggestionTool',
            args: {
              suggestionType: 'edge_case',
              title: 'Test concurrent login attempts',
              description: 'Test behavior when user attempts multiple simultaneous logins',
              targetSection: 'testCases',
              priority: 'medium',
              reasoning: 'Concurrent access can cause race conditions',
              implementationHint: 'Use multiple browser sessions or API calls',
              estimatedEffort: 'high',
              tags: ['concurrency', 'edge-case', 'race-condition']
            }
          }
        ]
      })

      const request = createRequest({
        currentDocument: mockCanvas,
        maxSuggestions: 1
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('suggestions')
      expect(data).toHaveProperty('totalCount')
      expect(data).toHaveProperty('generatedAt')
      expect(data).toHaveProperty('contextSummary')

      expect(Array.isArray(data.suggestions)).toBe(true)
      expect(data.totalCount).toBe(data.suggestions.length)
      expect(typeof data.generatedAt).toBe('string')
      expect(typeof data.contextSummary).toBe('string')

      // Verify suggestion structure
      const suggestion = data.suggestions[0]
      expect(suggestion).toHaveProperty('id')
      expect(suggestion).toHaveProperty('suggestionType')
      expect(suggestion).toHaveProperty('title')
      expect(suggestion).toHaveProperty('description')
      expect(suggestion).toHaveProperty('targetSection')
      expect(suggestion).toHaveProperty('priority')
      expect(suggestion).toHaveProperty('reasoning')
      expect(suggestion).toHaveProperty('implementationHint')
      expect(suggestion).toHaveProperty('estimatedEffort')
      expect(suggestion).toHaveProperty('tags')
    })
  })
})