/**
 * Unit tests for SectionTargetDetector
 * Tests section detection with various phrasings and scenarios
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { SectionTargetDetector } from '../../../../lib/ai/intent/sectionTargetDetector'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { CanvasSection } from '../../../../lib/ai/intent/types'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config)
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}))

describe('SectionTargetDetector', () => {
  let detector: SectionTargetDetector
  let mockGenerateText: Mock

  beforeEach(async () => {
    detector = new SectionTargetDetector()
    const aiModule = await import('ai')
    mockGenerateText = vi.mocked(aiModule).generateText as Mock
  })

  describe('detectTargetSections', () => {
    it('should detect acceptance criteria section from Spanish keywords', async () => {
      const result = await detector.detectTargetSections(
        'Los criterios de aceptación necesitan más detalle'
      )

      expect(result.primaryTargets).toContain('acceptanceCriteria')
      expect(result.keywords).toContain('criterios de aceptación')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should detect test cases section from English keywords', async () => {
      const result = await detector.detectTargetSections(
        'The test cases need to be updated'
      )

      expect(result.primaryTargets).toContain('testCases')
      expect(result.keywords).toContain('test cases')
      expect(result.confidence).toBeGreaterThan(0.4)
    })

    it('should detect ticket summary section', async () => {
      const result = await detector.detectTargetSections(
        'El resumen del ticket está incompleto'
      )

      expect(result.primaryTargets).toContain('ticketSummary')
      expect(result.keywords).toContain('resumen')
    })

    it('should detect multiple sections', async () => {
      const result = await detector.detectTargetSections(
        'Cambiar los criterios de aceptación y los test cases'
      )

      expect(result.primaryTargets).toContain('acceptanceCriteria')
      // testCases might be in primary or secondary targets
      const allTargets = [...result.primaryTargets, ...result.secondaryTargets]
      expect(allTargets).toContain('testCases')
      expect(result.primaryTargets.length).toBeGreaterThanOrEqual(1)
    })

    it('should use AI analysis for complex messages', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'sectionTargetDetection',
          args: {
            primaryTargets: ['acceptanceCriteria'],
            secondaryTargets: ['testCases'],
            confidence: 0.9,
            reasoning: 'User wants to improve acceptance criteria quality',
            keywords: ['mejorar', 'calidad'],
            detectionMethod: 'ai_analysis'
          }
        }]
      })

      const result = await detector.detectTargetSections(
        'Necesito mejorar la calidad de la documentación'
      )

      expect(result.primaryTargets).toContain('acceptanceCriteria')
      expect(result.secondaryTargets).toContain('testCases')
      expect(result.detectionMethod).toBe('hybrid')
      expect(mockGenerateText).toHaveBeenCalled()
    })

    it('should handle AI service failures gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))

      const result = await detector.detectTargetSections(
        'Los criterios están mal'
      )

      // Should fallback to keyword detection
      expect(result.detectionMethod).toBe('hybrid')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should consider canvas context in AI analysis', async () => {
      const canvas = createMockCanvas()
      
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'sectionTargetDetection',
          args: {
            primaryTargets: ['testCases'],
            secondaryTargets: [],
            confidence: 0.85,
            reasoning: 'Canvas has acceptance criteria but test cases need work',
            keywords: ['mejorar'],
            detectionMethod: 'ai_analysis'
          }
        }]
      })

      const result = await detector.detectTargetSections(
        'Esto necesita mejorar',
        canvas
      )

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Criterios de aceptación: 1 items')
        })
      )
    })

    it('should limit primary targets to maximum of 3', async () => {
      const result = await detector.detectTargetSections(
        'Cambiar resumen, criterios de aceptación, test cases, configuración y metadata'
      )

      expect(result.primaryTargets.length).toBeLessThanOrEqual(3)
    })

    it('should limit secondary targets to maximum of 2', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'sectionTargetDetection',
          args: {
            primaryTargets: ['acceptanceCriteria'],
            secondaryTargets: ['testCases', 'ticketSummary', 'configurationWarnings'],
            confidence: 0.8,
            reasoning: 'Multiple sections affected',
            keywords: ['cambiar'],
            detectionMethod: 'ai_analysis'
          }
        }]
      })

      const result = await detector.detectTargetSections(
        'Cambiar todo'
      )

      expect(result.secondaryTargets.length).toBeLessThanOrEqual(2)
    })

    it('should not include primary targets in secondary targets', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'sectionTargetDetection',
          args: {
            primaryTargets: ['acceptanceCriteria'],
            secondaryTargets: ['acceptanceCriteria', 'testCases'], // Duplicate
            confidence: 0.8,
            reasoning: 'Test with duplicate',
            keywords: ['cambiar'],
            detectionMethod: 'ai_analysis'
          }
        }]
      })

      const result = await detector.detectTargetSections(
        'Cambiar criterios'
      )

      expect(result.secondaryTargets).not.toContain('acceptanceCriteria')
      expect(result.primaryTargets).toContain('acceptanceCriteria')
    })

    it('should handle empty or vague messages', async () => {
      // Mock AI to return low confidence for empty messages
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'sectionTargetDetection',
          args: {
            primaryTargets: [],
            secondaryTargets: [],
            confidence: 0.1,
            reasoning: 'Empty message provides no clear indication',
            keywords: [],
            detectionMethod: 'ai_analysis'
          }
        }]
      })

      const result = await detector.detectTargetSections('')

      // Empty messages should have low confidence
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should detect configuration warnings section', async () => {
      const result = await detector.detectTargetSections(
        'Las advertencias de configuración son incorrectas'
      )

      // configurationWarnings might be in primary or secondary targets
      const allTargets = [...result.primaryTargets, ...result.secondaryTargets]
      expect(allTargets).toContain('configurationWarnings')
      expect(result.keywords).toContain('advertencias')
    })
  })

  describe('validateSections', () => {
    it('should filter out metadata section for user modifications', async () => {
      // Create a mock result that includes metadata
      const result = {
        primaryTargets: ['metadata' as CanvasSection, 'acceptanceCriteria' as CanvasSection],
        secondaryTargets: [],
        keywords: ['metadata', 'criterios'],
        confidence: 0.8,
        detectionMethod: 'keyword' as const
      }
      
      const canvas = createMockCanvas()
      const validated = detector.validateSections(result, canvas)

      expect(validated.primaryTargets).not.toContain('metadata')
      expect(validated.primaryTargets).toContain('acceptanceCriteria')
    })

    it('should filter out configuration warnings if none exist', async () => {
      const canvas = createMockCanvas()
      canvas.configurationWarnings = [] // No warnings

      const result = {
        primaryTargets: ['configurationWarnings' as CanvasSection],
        secondaryTargets: [],
        keywords: [],
        confidence: 0.8,
        detectionMethod: 'keyword' as const
      }

      const validated = detector.validateSections(result, canvas)

      expect(validated.primaryTargets).not.toContain('configurationWarnings')
    })

    it('should allow configuration warnings if they exist', async () => {
      const canvas = createMockCanvas()
      canvas.configurationWarnings = [{
        type: 'category_mismatch',
        title: 'Test warning',
        message: 'Test message',
        recommendation: 'Test recommendation',
        severity: 'medium'
      }]

      const result = {
        primaryTargets: ['configurationWarnings' as CanvasSection],
        secondaryTargets: [],
        keywords: [],
        confidence: 0.8,
        detectionMethod: 'keyword' as const
      }

      const validated = detector.validateSections(result, canvas)

      expect(validated.primaryTargets).toContain('configurationWarnings')
    })
  })

  describe('getSectionDisplayNames', () => {
    it('should return Spanish display names by default', () => {
      const sections: CanvasSection[] = ['acceptanceCriteria', 'testCases']
      const names = detector.getSectionDisplayNames(sections)

      expect(names).toContain('Criterios de aceptación')
      expect(names).toContain('Casos de prueba')
    })

    it('should return English display names when requested', () => {
      const sections: CanvasSection[] = ['acceptanceCriteria', 'testCases']
      const names = detector.getSectionDisplayNames(sections, 'en')

      expect(names).toContain('Acceptance criteria')
      expect(names).toContain('Test cases')
    })

    it('should handle all section types', () => {
      const sections: CanvasSection[] = [
        'ticketSummary',
        'acceptanceCriteria',
        'testCases',
        'configurationWarnings',
        'metadata'
      ]
      const names = detector.getSectionDisplayNames(sections)

      expect(names).toHaveLength(5)
      expect(names).toContain('Resumen del ticket')
      expect(names).toContain('Metadatos')
    })
  })

  describe('keyword detection accuracy', () => {
    it('should prioritize longer, more specific keywords', async () => {
      const result = await detector.detectTargetSections(
        'Los criterios de aceptación están mal'
      )

      // "criterios de aceptación" should score higher than just "criterios"
      expect(result.primaryTargets).toContain('acceptanceCriteria')
      expect(result.confidence).toBeGreaterThan(0.6)
    })

    it('should handle mixed language keywords', async () => {
      const result = await detector.detectTargetSections(
        'Los test cases y criterios need updating'
      )

      // Should detect at least one of the sections
      const allTargets = [...result.primaryTargets, ...result.secondaryTargets]
      expect(allTargets).toContain('testCases')
      expect(allTargets).toContain('acceptanceCriteria')
    })

    it('should be case insensitive', async () => {
      const result = await detector.detectTargetSections(
        'CRITERIOS DE ACEPTACIÓN están mal'
      )

      expect(result.primaryTargets).toContain('acceptanceCriteria')
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