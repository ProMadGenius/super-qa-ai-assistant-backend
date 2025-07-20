/**
 * Unit tests for ContextualResponseGenerator
 * Tests contextual response generation for information requests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { ContextualResponseGenerator } from '../../../../lib/ai/intent/contextualResponseGenerator'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { JiraTicket } from '../../../../lib/schemas/JiraTicket'
import type { CanvasSection } from '../../../../lib/ai/intent/types'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config)
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}))

describe('ContextualResponseGenerator', () => {
  let generator: ContextualResponseGenerator
  let mockGenerateText: Mock

  beforeEach(async () => {
    generator = new ContextualResponseGenerator()
    const aiModule = await import('ai')
    mockGenerateText = vi.mocked(aiModule).generateText as Mock
  })

  describe('generateContextualResponse', () => {
    it('should generate response explaining acceptance criteria', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "Los criterios de aceptación actuales definen los requisitos funcionales que debe cumplir la funcionalidad. El criterio 'Test criterion' especifica que el sistema debe permitir realizar la acción de prueba con prioridad 'must', lo cual significa que es obligatorio implementarlo.",
            relevantSections: ['acceptanceCriteria'],
            citations: [
              {
                section: 'acceptanceCriteria',
                content: 'Test criterion - Test description',
                relevance: 'high'
              }
            ],
            suggestedFollowUps: [
              '¿Te gustaría que explique algún criterio específico?',
              '¿Quieres saber cómo se relacionan con los test cases?'
            ],
            confidence: 0.9
          }
        }]
      })

      const result = await generator.generateContextualResponse(
        '¿Puedes explicarme los criterios de aceptación?',
        createMockCanvas()
      )

      expect(result.response).toContain('criterios de aceptación')
      expect(result.relevantSections).toContain('acceptanceCriteria')
      expect(result.citations).toHaveLength(1)
      expect(result.citations[0].section).toBe('acceptanceCriteria')
      expect(result.citations[0].relevance).toBe('high')
      expect(result.suggestedFollowUps.length).toBeGreaterThanOrEqual(2)
      expect(result.confidence).toBe(0.9)
    })

    it('should generate response explaining test cases', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "Los casos de prueba están en formato Gherkin, que es ideal para especificar comportamientos de manera clara. El escenario 'Test scenario' sigue la estructura Given-When-Then para definir precondiciones, acciones y resultados esperados.",
            relevantSections: ['testCases'],
            citations: [
              {
                section: 'testCases',
                content: 'Test scenario',
                relevance: 'high'
              }
            ],
            suggestedFollowUps: [
              '¿Quieres que explique el formato Gherkin?',
              '¿Te interesa saber si cubren todos los criterios?'
            ],
            confidence: 0.85
          }
        }]
      })

      const result = await generator.generateContextualResponse(
        '¿Cómo funcionan estos test cases?',
        createMockCanvas()
      )

      expect(result.response).toContain('casos de prueba')
      expect(result.response).toContain('Gherkin')
      expect(result.relevantSections).toContain('testCases')
      expect(result.citations[0].content).toBe('Test scenario')
    })

    it('should generate response with ticket context when available', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "Basándome en el ticket TEST-123 'Test ticket summary', el problema que se está resolviendo es mejorar la funcionalidad de prueba. Los criterios actuales abordan este problema definiendo requisitos específicos para la implementación.",
            relevantSections: ['ticketSummary', 'acceptanceCriteria'],
            citations: [
              {
                section: 'ticketSummary',
                content: 'Test problem',
                relevance: 'high'
              }
            ],
            suggestedFollowUps: [
              '¿Quieres más detalles sobre el problema original?',
              '¿Te interesa ver cómo los criterios abordan este problema?'
            ],
            confidence: 0.8
          }
        }]
      })

      const ticket = createMockTicket()
      const result = await generator.generateContextualResponse(
        '¿Qué problema resuelve este ticket?',
        createMockCanvas(),
        ticket
      )

      expect(result.response).toContain('TEST-123')
      expect(result.relevantSections).toContain('ticketSummary')
      expect(result.citations[0].section).toBe('ticketSummary')
    })

    it('should handle AI service failures gracefully', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))

      const result = await generator.generateContextualResponse(
        '¿Puedes explicarme los criterios?',
        createMockCanvas()
      )

      // Should fallback to template response
      expect(result.response).toBeDefined()
      expect(result.response.length).toBeGreaterThan(0)
      expect(result.relevantSections).toContain('acceptanceCriteria')
      expect(result.confidence).toBe(0.6)
    })

    it('should generate analysis response for quality questions', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "Los criterios de aceptación actuales están bien estructurados. Tienen prioridades claras (must/should/could) y son testables. Sin embargo, podrían beneficiarse de más detalles técnicos específicos para algunos escenarios edge.",
            relevantSections: ['acceptanceCriteria'],
            citations: [
              {
                section: 'acceptanceCriteria',
                content: 'Test criterion - priority: must, testable: true',
                relevance: 'high'
              }
            ],
            suggestedFollowUps: [
              '¿Quieres que identifique qué criterios necesitan más detalle?',
              '¿Te interesa saber sobre mejores prácticas para criterios?'
            ],
            confidence: 0.75
          }
        }]
      })

      const result = await generator.generateContextualResponse(
        '¿Están bien estos criterios de aceptación?',
        createMockCanvas()
      )

      expect(result.response).toContain('bien estructurados')
      expect(result.response).toContain('testables')
      expect(result.suggestedFollowUps.some(s => s.includes('mejores prácticas'))).toBe(true)
    })

    it('should generate methodology response for format questions', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "Se usa el formato Gherkin para los test cases porque proporciona una estructura clara y legible tanto para técnicos como no técnicos. La sintaxis Given-When-Then hace que los casos de prueba sean fáciles de entender y mantener.",
            relevantSections: ['testCases'],
            citations: [
              {
                section: 'testCases',
                content: 'format: gherkin - Given-When-Then structure',
                relevance: 'high'
              }
            ],
            suggestedFollowUps: [
              '¿Quieres saber sobre otros formatos de test cases?',
              '¿Te interesa conocer las ventajas del formato Gherkin?'
            ],
            confidence: 0.9
          }
        }]
      })

      const result = await generator.generateContextualResponse(
        '¿Por qué se usa formato Gherkin?',
        createMockCanvas()
      )

      expect(result.response).toContain('Gherkin')
      expect(result.response).toContain('Given-When-Then')
      expect(result.relevantSections).toContain('testCases')
    })

    it('should handle empty canvas gracefully', async () => {
      const emptyCanvas = createEmptyCanvas()
      
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "El lienzo QA está actualmente vacío. No hay criterios de aceptación ni casos de prueba definidos. Esto sugiere que el análisis del ticket aún no se ha completado o que se necesita más información para generar el contenido.",
            relevantSections: [],
            citations: [],
            suggestedFollowUps: [
              '¿Quieres que analice el ticket para generar contenido?',
              '¿Necesitas ayuda para definir criterios de aceptación?'
            ],
            confidence: 0.8
          }
        }]
      })

      const result = await generator.generateContextualResponse(
        '¿Qué hay en este lienzo?',
        emptyCanvas
      )

      expect(result.response).toContain('vacío')
      expect(result.relevantSections.length).toBeGreaterThanOrEqual(0)
      expect(result.citations).toHaveLength(0)
    })

    it('should validate citations against actual content', async () => {
      mockGenerateText.mockResolvedValue({
        toolCalls: [{
          toolName: 'contextualResponse',
          args: {
            response: "Response with citations",
            relevantSections: ['acceptanceCriteria'],
            citations: [
              {
                section: 'acceptanceCriteria',
                content: 'Test criterion', // Valid - matches actual content
                relevance: 'high'
              },
              {
                section: 'acceptanceCriteria',
                content: 'Non-existent criterion', // Invalid - doesn't match
                relevance: 'medium'
              }
            ],
            suggestedFollowUps: ['Follow up'],
            confidence: 0.8
          }
        }]
      })

      const result = await generator.generateContextualResponse(
        'Explain criteria',
        createMockCanvas()
      )

      // Should filter out invalid citations
      expect(result.citations).toHaveLength(1)
      expect(result.citations[0].content).toBe('Test criterion')
    })
  })

  describe('utility methods', () => {
    it('should extract topics correctly', () => {
      const topics1 = generator.extractTopics('¿Puedes explicarme los criterios de aceptación?')
      expect(topics1.sections).toContain('acceptanceCriteria')
      expect(topics1.questionType).toBe('explanation')
      expect(topics1.keywords).toContain('criterios de aceptación')

      const topics2 = generator.extractTopics('¿Están bien estos test cases?')
      expect(topics2.sections).toContain('testCases')
      expect(topics2.questionType).toBe('general')

      const topics3 = generator.extractTopics('¿Por qué se usa este formato?')
      expect(topics3.questionType).toBe('methodology')
    })

    it('should generate section insights', () => {
      const canvas = createMockCanvas()
      
      const criteriaInsight = generator.generateSectionInsights('acceptanceCriteria', canvas)
      expect(criteriaInsight).toContain('1 criterios de aceptación')
      expect(criteriaInsight).toContain('must')

      const testCasesInsight = generator.generateSectionInsights('testCases', canvas)
      expect(testCasesInsight).toContain('1 casos de prueba')
      expect(testCasesInsight).toContain('gherkin')

      const summaryInsight = generator.generateSectionInsights('ticketSummary', canvas)
      expect(summaryInsight).toContain('problema definido')
      expect(summaryInsight).toContain('solución especificada')
    })

    it('should handle empty sections in insights', () => {
      const emptyCanvas = createEmptyCanvas()
      
      const criteriaInsight = generator.generateSectionInsights('acceptanceCriteria', emptyCanvas)
      expect(criteriaInsight).toContain('No hay criterios')

      const testCasesInsight = generator.generateSectionInsights('testCases', emptyCanvas)
      expect(testCasesInsight).toContain('No hay casos de prueba')
    })
  })

  describe('fallback responses', () => {
    it('should generate appropriate fallback for criteria questions', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await generator.generateContextualResponse(
        'Explícame los criterios',
        createMockCanvas()
      )

      expect(result.response).toContain('criterios de aceptación')
      expect(result.relevantSections).toContain('acceptanceCriteria')
      expect(result.citations).toHaveLength(1)
    })

    it('should generate appropriate fallback for test case questions', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await generator.generateContextualResponse(
        'Háblame de los test cases',
        createMockCanvas()
      )

      expect(result.response).toContain('casos de prueba')
      expect(result.relevantSections).toContain('testCases')
    })

    it('should generate generic fallback for unclear questions', async () => {
      mockGenerateText.mockRejectedValue(new Error('AI failed'))

      const result = await generator.generateContextualResponse(
        'Información general',
        createMockCanvas()
      )

      expect(result.response).toContain('lienzo QA')
      expect(result.relevantSections.length).toBeGreaterThan(0)
      expect(result.suggestedFollowUps.length).toBeGreaterThan(0)
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

/**
 * Helper function to create an empty QA Canvas Document
 */
function createEmptyCanvas(): QACanvasDocument {
  return {
    ticketSummary: {
      problem: '',
      solution: '',
      context: ''
    },
    configurationWarnings: [],
    acceptanceCriteria: [],
    testCases: [],
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

/**
 * Helper function to create a mock Jira Ticket
 */
function createMockTicket(): JiraTicket {
  return {
    issueKey: 'TEST-123',
    summary: 'Test ticket summary',
    description: 'Test ticket description with more details about the functionality',
    status: 'In Progress',
    priority: 'High',
    issueType: 'Story',
    assignee: 'Test User',
    reporter: 'Reporter User',
    comments: [],
    attachments: [],
    components: ['Test Component'],
    customFields: {},
    scrapedAt: new Date().toISOString()
  }
}