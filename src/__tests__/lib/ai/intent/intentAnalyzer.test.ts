/**
 * Unit tests for IntentAnalyzer
 * Tests intent classification with various message types and scenarios
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import type { UIMessage } from 'ai'
import { IntentAnalyzer } from '../../../../lib/ai/intent/intentAnalyzer'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { IntentType } from '../../../../lib/ai/intent/types'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config)
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}))

describe('IntentAnalyzer', () => {
  let intentAnalyzer: IntentAnalyzer
  let mockGenerateText: Mock

  beforeEach(async () => {
    intentAnalyzer = new IntentAnalyzer()
    const aiModule = await import('ai')
    mockGenerateText = vi.mocked(aiModule).generateText as Mock
  })

  describe('analyzeIntent', () => {
    it('should classify modification requests correctly', async () => {
      // Mock AI response
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'modify_canvas',
            confidence: 0.9,
            targetSections: ['acceptanceCriteria'],
            reasoning: 'User explicitly wants to change acceptance criteria',
            keywords: ['cambiar', 'criterios de aceptación'],
            shouldModifyCanvas: true,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        'Necesito cambiar los criterios de aceptación',
        [],
        createMockCanvas()
      )

      expect(result.intent).toBe('modify_canvas')
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.targetSections).toContain('acceptanceCriteria')
      expect(result.shouldModifyCanvas).toBe(true)
      expect(result.requiresClarification).toBe(false)
    })

    it('should classify vague complaints as clarification requests', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'ask_clarification',
            confidence: 0.8,
            targetSections: ['acceptanceCriteria'],
            reasoning: 'User says something is wrong but doesn\'t specify what to change',
            keywords: ['está mal', 'criterios'],
            shouldModifyCanvas: false,
            requiresClarification: true
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        'Los criterios de aceptación están mal',
        [],
        createMockCanvas()
      )

      expect(result.intent).toBe('ask_clarification')
      expect(result.requiresClarification).toBe(true)
      expect(result.shouldModifyCanvas).toBe(false)
    })

    it('should classify information requests correctly', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'provide_information',
            confidence: 0.85,
            targetSections: ['testCases'],
            reasoning: 'User is asking for explanation of existing content',
            keywords: ['explícame', 'test cases'],
            shouldModifyCanvas: false,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        '¿Puedes explicarme estos test cases?',
        [],
        createMockCanvas()
      )

      expect(result.intent).toBe('provide_information')
      expect(result.shouldModifyCanvas).toBe(false)
      expect(result.targetSections).toContain('testCases')
    })

    it('should classify off-topic requests correctly', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'off_topic',
            confidence: 0.95,
            targetSections: [],
            reasoning: 'User is asking about sports, not related to QA or testing',
            keywords: ['fútbol', 'partido'],
            shouldModifyCanvas: false,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        '¿Quién ganó el partido de fútbol ayer?',
        [],
        createMockCanvas()
      )

      expect(result.intent).toBe('off_topic')
      expect(result.targetSections).toHaveLength(0)
      expect(result.shouldModifyCanvas).toBe(false)
    })

    it('should handle AI service failures gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))

      const result = await intentAnalyzer.analyzeIntent(
        'Cambiar los criterios',
        [],
        createMockCanvas()
      )

      // Should fallback to keyword analysis
      expect(result.intent).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.reasoning).toBeDefined()
    })

    it('should detect multiple target sections', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'modify_canvas',
            confidence: 0.85,
            targetSections: ['acceptanceCriteria', 'testCases'],
            reasoning: 'User wants to modify both acceptance criteria and test cases',
            keywords: ['cambiar', 'criterios', 'test cases'],
            shouldModifyCanvas: true,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        'Necesito cambiar los criterios de aceptación y los test cases',
        [],
        createMockCanvas()
      )

      expect(result.targetSections).toContain('acceptanceCriteria')
      expect(result.targetSections).toContain('testCases')
      expect(result.targetSections).toHaveLength(2)
    })

    it('should consider conversation history', async () => {
      const conversationHistory: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Los criterios están mal',
          createdAt: new Date()
        } as any,
        {
          id: '2',
          role: 'assistant',
          content: '¿Qué específicamente necesita cambiar?',
          createdAt: new Date()
        } as any
      ]

      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'modify_canvas',
            confidence: 0.8,
            targetSections: ['acceptanceCriteria'],
            reasoning: 'Following up on previous clarification request',
            keywords: ['más específicos'],
            shouldModifyCanvas: true,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        'Necesitan ser más específicos',
        conversationHistory,
        createMockCanvas()
      )

      expect(result.intent).toBe('modify_canvas')
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('user: Los criterios están mal')
        })
      )
    })

    it('should work without canvas context', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'provide_information',
            confidence: 0.7,
            targetSections: [],
            reasoning: 'User asking for general information, no canvas available',
            keywords: ['información'],
            shouldModifyCanvas: false,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        '¿Qué información tienes?',
        []
        // No canvas provided
      )

      expect(result.intent).toBe('provide_information')
      expect(result.context.hasCanvas).toBe(false)
      expect(result.context.availableSections).toHaveLength(0)
    })

    it('should handle complex canvas correctly', async () => {
      const complexCanvas = createMockCanvas()
      // Add more items to make it complex
      for (let i = 0; i < 20; i++) {
        complexCanvas.acceptanceCriteria.push({
          id: `ac-${i}`,
          title: `Criterion ${i}`,
          description: `Description ${i}`,
          priority: 'must',
          category: 'functional',
          testable: true
        })
      }

      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'intentClassification',
          args: {
            intent: 'modify_canvas',
            confidence: 0.8,
            targetSections: ['acceptanceCriteria'],
            reasoning: 'User wants to modify complex canvas',
            keywords: ['cambiar'],
            shouldModifyCanvas: true,
            requiresClarification: false
          }
        }]
      })

      const result = await intentAnalyzer.analyzeIntent(
        'Cambiar algunos criterios',
        [],
        complexCanvas
      )

      expect(result.context.canvasComplexity).toBe('complex')
      expect(result.context.hasCanvas).toBe(true)
    })
  })

  describe('keyword analysis', () => {
    it('should detect Spanish modification keywords', async () => {
      // Force AI to fail so we test keyword fallback
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await intentAnalyzer.analyzeIntent(
        'Necesito modificar los criterios de aceptación',
        []
      )

      expect(result.keywords).toContain('modificar')
      expect(result.targetSections).toContain('acceptanceCriteria')
    })

    it('should detect English modification keywords', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await intentAnalyzer.analyzeIntent(
        'I need to change the test cases',
        []
      )

      expect(result.keywords).toContain('change')
      expect(result.targetSections).toContain('testCases')
    })

    it('should detect multiple sections from keywords', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await intentAnalyzer.analyzeIntent(
        'Cambiar el resumen y los test cases',
        []
      )

      expect(result.targetSections).toContain('ticketSummary')
      expect(result.targetSections).toContain('testCases')
    })
  })
})

/**
 * Helper function to create a mock QA Canvas Document
 */
function createMockCanvas(): QACanvasDocument {
  return {
    ticketSummary: {
      problem: 'Test problem',
      solution: 'Test solution',
      context: 'Test context'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Test criterion',
        description: 'Test description',
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
          scenario: 'Test scenario',
          given: ['Given condition'],
          when: ['When action'],
          then: ['Then result'],
          tags: ['@test']
        }
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      qaProfile: {
        qaCategories: {
          functional: true,
          ux: false,
          ui: false,
          negative: false,
          api: false,
          database: false,
          performance: false,
          security: false,
          mobile: false,
          accessibility: false
        },
        testCaseFormat: 'gherkin',
        autoRefresh: true,
        includeComments: true,
        includeImages: true,
        operationMode: 'offline',
        showNotifications: true
      },
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  }
}