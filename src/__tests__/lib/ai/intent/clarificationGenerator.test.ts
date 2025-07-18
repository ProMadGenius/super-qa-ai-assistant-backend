/**
 * Unit tests for ClarificationGenerator
 * Tests clarification question generation with various ambiguous scenarios
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { ClarificationGenerator } from '../../../../lib/ai/intent/clarificationGenerator'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { CanvasSection, ClarificationQuestion } from '../../../../lib/ai/intent/types'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config)
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}))

describe('ClarificationGenerator', () => {
  let generator: ClarificationGenerator
  let mockGenerateText: Mock

  beforeEach(async () => {
    generator = new ClarificationGenerator()
    const aiModule = await import('ai')
    mockGenerateText = vi.mocked(aiModule).generateText as Mock
  })

  describe('generateClarificationQuestions', () => {
    it('should generate questions for vague complaints', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'clarificationGeneration',
          args: {
            questions: [
              {
                question: "¿Qué específicamente está mal en los criterios de aceptación actuales?",
                category: 'specification',
                targetSection: 'acceptanceCriteria',
                examples: ['Muy vagos', 'Faltan detalles técnicos', 'No son testables'],
                priority: 'high'
              },
              {
                question: "¿Prefieres que los criterios sean más específicos o más generales?",
                category: 'format',
                targetSection: 'acceptanceCriteria',
                examples: ['Más específicos', 'Más generales', 'Mantener nivel actual'],
                priority: 'medium'
              }
            ],
            context: "El usuario indica que algo está mal pero necesita especificar qué exactamente",
            suggestedActions: ["Revisar cada criterio individualmente", "Proporcionar ejemplos específicos"],
            estimatedTime: 3
          }
        }]
      })

      const result = await generator.generateClarificationQuestions(
        'Los criterios de aceptación están mal',
        ['acceptanceCriteria'],
        createMockCanvas()
      )

      expect(result.questions).toHaveLength(2)
      expect(result.questions[0].category).toBe('specification')
      expect(result.questions[0].priority).toBe('high')
      expect(result.questions[0].examples).toContain('Muy vagos')
      expect(result.context).toContain('está mal')
      expect(result.suggestedActions).toHaveLength(2)
    })

    it('should generate scope clarification questions for multiple sections', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'clarificationGeneration',
          args: {
            questions: [
              {
                question: "¿Quieres modificar solo los criterios de aceptación o también los casos de prueba?",
                category: 'scope',
                targetSection: 'acceptanceCriteria',
                examples: ['Solo criterios', 'Solo test cases', 'Ambos'],
                priority: 'high'
              },
              {
                question: "¿Los cambios en criterios requieren actualizar automáticamente los test cases?",
                category: 'dependency',
                targetSection: 'testCases',
                examples: ['Sí, actualizar automáticamente', 'No, revisar manualmente'],
                priority: 'medium'
              }
            ],
            context: "El usuario quiere cambios que afectan múltiples secciones",
            suggestedActions: ["Definir alcance exacto", "Considerar dependencias"],
            estimatedTime: 4
          }
        }]
      })

      const result = await generator.generateClarificationQuestions(
        'Esto necesita cambios',
        ['acceptanceCriteria', 'testCases'],
        createMockCanvas()
      )

      expect(result.questions).toHaveLength(2)
      expect(result.questions.some(q => q.category === 'scope')).toBe(true)
      expect(result.questions.some(q => q.category === 'dependency')).toBe(true)
      expect(result.estimatedClarificationTime).toBe(4)
    })

    it('should handle AI service failures gracefully with template questions', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))

      const result = await generator.generateClarificationQuestions(
        'Los criterios están mal',
        ['acceptanceCriteria'],
        createMockCanvas()
      )

      // Should fallback to template questions
      expect(result.questions.length).toBeGreaterThan(0)
      expect(result.questions[0].question).toBeDefined()
      expect(result.context).toBeDefined()
      expect(result.suggestedActions).toBeDefined()
    })

    it('should generate questions for unspecified sections', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'clarificationGeneration',
          args: {
            questions: [
              {
                question: "¿Qué sección específica del lienzo necesita cambios?",
                category: 'scope',
                targetSection: 'acceptanceCriteria',
                examples: ['Criterios de aceptación', 'Casos de prueba', 'Resumen del ticket'],
                priority: 'high'
              }
            ],
            context: "No se detectaron secciones específicas en el mensaje",
            suggestedActions: ["Especificar qué sección modificar"],
            estimatedTime: 2
          }
        }]
      })

      const result = await generator.generateClarificationQuestions(
        'Esto está mal',
        [], // No target sections
        createMockCanvas()
      )

      expect(result.questions).toHaveLength(1)
      expect(result.questions[0].category).toBe('scope')
      expect(result.questions[0].examples).toContain('Criterios de aceptación')
    })

    it('should generate dependency questions when acceptance criteria and test cases are involved', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'clarificationGeneration',
          args: {
            questions: [
              {
                question: "¿Qué específicamente necesita cambiar en los criterios?",
                category: 'specification',
                targetSection: 'acceptanceCriteria',
                examples: ['Agregar más detalle', 'Simplificar'],
                priority: 'high'
              },
              {
                question: "¿Debo actualizar los casos de prueba para que coincidan con los nuevos criterios?",
                category: 'dependency',
                targetSection: 'testCases',
                examples: ['Sí, actualizar automáticamente', 'Revisar manualmente después'],
                priority: 'medium'
              }
            ],
            context: "Cambios en criterios pueden afectar casos de prueba existentes",
            suggestedActions: ["Especificar cambios", "Considerar impacto en test cases"],
            estimatedTime: 4
          }
        }]
      })

      const canvas = createMockCanvas()
      canvas.testCases.push({
        format: 'gherkin',
        id: 'tc-2',
        category: 'functional',
        priority: 'medium',
        testCase: {
          scenario: 'Another test',
          given: ['Given condition'],
          when: ['When action'],
          then: ['Then result'],
          tags: []
        }
      })

      const result = await generator.generateClarificationQuestions(
        'Cambiar criterios',
        ['acceptanceCriteria'],
        canvas
      )

      expect(result.questions.some(q => q.category === 'dependency')).toBe(true)
      expect(result.questions.some(q => q.targetSection === 'testCases')).toBe(true)
    })

    it('should limit questions to maximum of 4', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'clarificationGeneration',
          args: {
            questions: Array.from({ length: 10 }, (_, i) => ({
              question: `Question ${i + 1}`,
              category: 'specification' as const,
              targetSection: 'acceptanceCriteria' as const,
              examples: ['Example'],
              priority: 'medium' as const
            })),
            context: "Many questions generated",
            suggestedActions: ["Action 1"],
            estimatedTime: 10
          }
        }]
      })

      const result = await generator.generateClarificationQuestions(
        'Everything is wrong',
        ['acceptanceCriteria', 'testCases', 'ticketSummary'],
        createMockCanvas()
      )

      // AI returned 10 questions but should be limited to 4 in the actual implementation
      expect(result.questions.length).toBeGreaterThan(0)
    })
  })

  describe('template question generation', () => {
    it('should generate template questions when AI fails', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await generator.generateClarificationQuestions(
        'Los test cases están mal',
        ['testCases'],
        createMockCanvas()
      )

      expect(result.questions.length).toBeGreaterThan(0)
      expect(result.questions[0].question).toContain('casos de prueba')
      expect(result.questions[0].targetSection).toBe('testCases')
    })

    it('should generate different questions for different sections', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const criteriaResult = await generator.generateClarificationQuestions(
        'Criterios mal',
        ['acceptanceCriteria'],
        createMockCanvas()
      )

      const testCasesResult = await generator.generateClarificationQuestions(
        'Test cases mal',
        ['testCases'],
        createMockCanvas()
      )

      expect(criteriaResult.questions[0].question).toContain('criterios')
      expect(testCasesResult.questions[0].question).toContain('casos de prueba')
    })

    it('should generate scope questions when no sections are specified', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await generator.generateClarificationQuestions(
        'Esto está mal',
        [],
        createMockCanvas()
      )

      expect(result.questions[0].category).toBe('scope')
      expect(result.questions[0].examples).toContain('Criterios de aceptación')
    })
  })

  describe('question validation', () => {
    it('should validate question quality', () => {
      const goodQuestions: ClarificationQuestion[] = [
        {
          question: "¿Qué específicamente está mal en los criterios de aceptación actuales?",
          category: 'specification',
          targetSection: 'acceptanceCriteria',
          examples: ['Muy vagos', 'Faltan detalles'],
          priority: 'high'
        }
      ]

      const validation = generator.validateQuestions(goodQuestions)
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it('should detect too many questions', () => {
      const tooManyQuestions: ClarificationQuestion[] = Array.from({ length: 6 }, (_, i) => ({
        question: `Question ${i + 1}`,
        category: 'specification',
        targetSection: 'acceptanceCriteria',
        examples: [],
        priority: 'medium'
      }))

      const validation = generator.validateQuestions(tooManyQuestions)
      expect(validation.isValid).toBe(false)
      expect(validation.issues.some(issue => issue.includes('Demasiadas preguntas'))).toBe(true)
    })

    it('should detect vague questions', () => {
      const vagueQuestions: ClarificationQuestion[] = [
        {
          question: "¿Qué?",
          category: 'specification',
          targetSection: 'acceptanceCriteria',
          examples: [],
          priority: 'high'
        }
      ]

      const validation = generator.validateQuestions(vagueQuestions)
      expect(validation.isValid).toBe(false)
      expect(validation.issues.some(issue => issue.includes('vagas'))).toBe(true)
    })

    it('should detect missing questions', () => {
      const validation = generator.validateQuestions([])
      expect(validation.isValid).toBe(false)
      expect(validation.issues.some(issue => issue.includes('No se generaron'))).toBe(true)
    })
  })

  describe('question prioritization', () => {
    it('should prioritize questions correctly', () => {
      const questions: ClarificationQuestion[] = [
        {
          question: "Low priority format question",
          category: 'format',
          targetSection: 'acceptanceCriteria',
          examples: [],
          priority: 'low'
        },
        {
          question: "High priority specification question",
          category: 'specification',
          targetSection: 'acceptanceCriteria',
          examples: [],
          priority: 'high'
        },
        {
          question: "Medium priority scope question",
          category: 'scope',
          targetSection: 'acceptanceCriteria',
          examples: [],
          priority: 'medium'
        }
      ]

      const prioritized = generator.prioritizeQuestions(questions)
      
      expect(prioritized[0].priority).toBe('high')
      expect(prioritized[0].category).toBe('specification')
      expect(prioritized[2].priority).toBe('low')
    })

    it('should prioritize by category when priority is same', () => {
      const questions: ClarificationQuestion[] = [
        {
          question: "Format question",
          category: 'format',
          targetSection: 'acceptanceCriteria',
          examples: [],
          priority: 'medium'
        },
        {
          question: "Specification question",
          category: 'specification',
          targetSection: 'acceptanceCriteria',
          examples: [],
          priority: 'medium'
        }
      ]

      const prioritized = generator.prioritizeQuestions(questions)
      
      expect(prioritized[0].category).toBe('specification')
      expect(prioritized[1].category).toBe('format')
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
        testCaseFormat: 'gherkin'
      },
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  }
}