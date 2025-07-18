/**
 * ContextualResponseGenerator - Generates informative responses without modifying canvas
 * Provides contextual information using current canvas and ticket data
 */

import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { 
  ContextualResponse, 
  ContentCitation,
  CanvasSection 
} from './types'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import type { JiraTicket } from '../../schemas/JiraTicket'
import { canvasSectionSchema } from './types'

/**
 * AI tool for contextual response generation
 */
const contextualResponseTool = tool({
  description: "Generate informative contextual responses using canvas and ticket data without modifying content",
  parameters: z.object({
    response: z.string().describe("The informative response to the user's question"),
    relevantSections: z.array(canvasSectionSchema).describe("Canvas sections that are relevant to the response"),
    citations: z.array(z.object({
      section: canvasSectionSchema,
      content: z.string().describe("Specific content being referenced"),
      relevance: z.enum(['high', 'medium', 'low']).describe("How relevant this citation is")
    })).describe("Specific citations from the canvas content"),
    suggestedFollowUps: z.array(z.string()).describe("Suggested follow-up questions or actions"),
    confidence: z.number().min(0).max(1).describe("Confidence in the response accuracy")
  })
})

/**
 * ContextualResponseGenerator class for generating informative responses
 */
export class ContextualResponseGenerator {
  private readonly model = openai('gpt-4o-mini')

  /**
   * Generate contextual response for information requests
   */
  async generateContextualResponse(
    userMessage: string,
    currentCanvas: QACanvasDocument,
    originalTicket?: JiraTicket
  ): Promise<ContextualResponse> {
    try {
      // Try AI-powered generation first
      const aiResponse = await this.performAIGeneration(userMessage, currentCanvas, originalTicket)
      
      // Validate and enhance the response
      return this.enhanceResponse(aiResponse, currentCanvas)
      
    } catch (error) {
      console.error('Contextual response generation failed:', error)
      return this.generateFallbackResponse(userMessage, currentCanvas, originalTicket)
    }
  }

  /**
   * Perform AI-powered contextual response generation
   */
  private async performAIGeneration(
    userMessage: string,
    currentCanvas: QACanvasDocument,
    originalTicket?: JiraTicket
  ): Promise<ContextualResponse> {
    
    const systemPrompt = this.buildSystemPrompt(currentCanvas, originalTicket)
    
    const result = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: `
El usuario está pidiendo información sobre el lienzo QA actual. Proporciona una respuesta informativa y útil:

Pregunta del usuario: "${userMessage}"

CONTENIDO ACTUAL DEL LIENZO:

Resumen del ticket:
- Problema: ${currentCanvas.ticketSummary.problem || 'No especificado'}
- Solución: ${currentCanvas.ticketSummary.solution || 'No especificada'}
- Contexto: ${currentCanvas.ticketSummary.context || 'No especificado'}

Criterios de aceptación (${currentCanvas.acceptanceCriteria.length} items):
${currentCanvas.acceptanceCriteria.map((ac, i) => 
  `${i + 1}. ${ac.title} - ${ac.description} (Prioridad: ${ac.priority})`
).join('\n')}

Casos de prueba (${currentCanvas.testCases.length} items):
${currentCanvas.testCases.map((tc, i) => 
  `${i + 1}. ${tc.testCase.scenario || tc.testCase.title || `Test Case ${tc.id}`} (${tc.format})`
).join('\n')}

${currentCanvas.configurationWarnings.length > 0 ? `
Advertencias de configuración:
${currentCanvas.configurationWarnings.map(w => `- ${w.title}: ${w.message}`).join('\n')}
` : ''}

${originalTicket ? `
INFORMACIÓN DEL TICKET ORIGINAL:
- ID: ${originalTicket.issueKey}
- Título: ${originalTicket.summary}
- Descripción: ${originalTicket.description.substring(0, 500)}...
- Estado: ${originalTicket.status}
- Tipo: ${originalTicket.issueType}
` : ''}

Proporciona una respuesta informativa, específica y útil que ayude al usuario a entender el contenido actual.
      `,
      tools: { contextualResponse: contextualResponseTool },
      toolChoice: 'required',
      maxTokens: 1500,
      temperature: 0.3
    })

    const toolCall = result.toolCalls[0]
    if (toolCall?.toolName === 'contextualResponse') {
      const args = toolCall.args
      return {
        response: args.response,
        relevantSections: args.relevantSections,
        citations: args.citations.map(c => ({
          section: c.section,
          content: c.content,
          relevance: c.relevance
        })),
        suggestedFollowUps: args.suggestedFollowUps,
        confidence: args.confidence
      }
    }
    
    throw new Error('AI contextual response generation did not return expected tool call')
  }

  /**
   * Build system prompt for AI generation
   */
  private buildSystemPrompt(
    currentCanvas: QACanvasDocument,
    originalTicket?: JiraTicket
  ): string {
    return `
Eres un experto analista QA que proporciona respuestas informativas y contextuales sobre documentación de pruebas.

Tu trabajo es ayudar a los usuarios a entender el contenido actual del lienzo QA sin modificarlo.

TIPOS DE PREGUNTAS QUE PUEDES RESPONDER:

1. **Explicaciones de contenido**: "¿Qué significan estos criterios?", "¿Cómo funcionan estos test cases?"
2. **Análisis de calidad**: "¿Están bien estos criterios?", "¿Qué tan completos son los test cases?"
3. **Relaciones y dependencias**: "¿Cómo se relacionan los criterios con los test cases?"
4. **Metodologías**: "¿Por qué se usa este formato?", "¿Qué mejores prácticas se siguen?"
5. **Contexto del ticket**: "¿Qué problema resuelve esto?", "¿Cuál es el objetivo?"

REGLAS PARA RESPUESTAS:

1. **Específicas**: Usa contenido real del lienzo y ticket
2. **Educativas**: Explica el "por qué" además del "qué"
3. **Contextualizadas**: Relaciona con el ticket original cuando sea relevante
4. **Citas precisas**: Referencia contenido específico con citas exactas
5. **Seguimientos útiles**: Sugiere preguntas o acciones relacionadas

FORMATO DE CITAS:
- Incluye el contenido exacto que estás referenciando
- Especifica de qué sección viene
- Indica la relevancia (high/medium/low)

CONTEXTO DEL LIENZO ACTUAL:
- Complejidad: ${this.assessCanvasComplexity(currentCanvas)}
- Secciones con contenido: ${this.getPopulatedSections(currentCanvas).join(', ')}
- Total de items: ${this.getTotalItems(currentCanvas)}
- Formato de test cases: ${this.getTestCaseFormats(currentCanvas).join(', ')}

${originalTicket ? `
CONTEXTO DEL TICKET:
- Tipo: ${originalTicket.issueType}
- Estado: ${originalTicket.status}
- Componentes: ${originalTicket.components?.join(', ') || 'No especificados'}
` : 'No hay información del ticket original disponible.'}

EJEMPLOS DE BUENAS RESPUESTAS:
- "Los criterios de aceptación actuales se enfocan en [aspecto específico]. El criterio 'X' es particularmente importante porque..."
- "Los test cases están en formato Gherkin, lo cual es apropiado para este tipo de funcionalidad porque..."
- "Basándome en el ticket original, estos criterios cubren [aspectos específicos] pero podrían beneficiarse de..."
    `
  }

  /**
   * Enhance response with additional context and validation
   */
  private enhanceResponse(
    response: ContextualResponse,
    currentCanvas: QACanvasDocument
  ): ContextualResponse {
    // Validate citations against actual content
    const validatedCitations = this.validateCitations(response.citations, currentCanvas)
    
    // Add missing relevant sections if needed
    const enhancedRelevantSections = this.identifyRelevantSections(
      response.response, 
      currentCanvas,
      response.relevantSections
    )
    
    // Enhance follow-up suggestions
    const enhancedFollowUps = this.enhanceFollowUpSuggestions(
      response.suggestedFollowUps,
      currentCanvas
    )
    
    return {
      ...response,
      relevantSections: enhancedRelevantSections,
      citations: validatedCitations,
      suggestedFollowUps: enhancedFollowUps
    }
  }

  /**
   * Generate fallback response when AI fails
   */
  private generateFallbackResponse(
    userMessage: string,
    currentCanvas: QACanvasDocument,
    originalTicket?: JiraTicket
  ): ContextualResponse {
    console.warn('Using fallback contextual response generation')
    
    const messageLower = userMessage.toLowerCase()
    let response = ''
    const relevantSections: CanvasSection[] = []
    const citations: ContentCitation[] = []
    
    // Detect what the user is asking about
    if (messageLower.includes('criterios') || messageLower.includes('criteria')) {
      relevantSections.push('acceptanceCriteria')
      response = `El lienzo actual tiene ${currentCanvas.acceptanceCriteria.length} criterios de aceptación. `
      
      if (currentCanvas.acceptanceCriteria.length > 0) {
        const firstCriterion = currentCanvas.acceptanceCriteria[0]
        response += `Por ejemplo, el primer criterio es "${firstCriterion.title}" con prioridad ${firstCriterion.priority}.`
        citations.push({
          section: 'acceptanceCriteria',
          content: `${firstCriterion.title} - ${firstCriterion.description}`,
          relevance: 'high'
        })
      }
    }
    
    if (messageLower.includes('test') || messageLower.includes('prueba')) {
      relevantSections.push('testCases')
      response += ` Hay ${currentCanvas.testCases.length} casos de prueba en formato ${this.getTestCaseFormats(currentCanvas).join(', ')}.`
      
      if (currentCanvas.testCases.length > 0) {
        const firstTestCase = currentCanvas.testCases[0]
        const scenario = firstTestCase.testCase.scenario || firstTestCase.testCase.title || `Test Case ${firstTestCase.id}`
        citations.push({
          section: 'testCases',
          content: scenario,
          relevance: 'high'
        })
      }
    }
    
    if (messageLower.includes('resumen') || messageLower.includes('summary') || messageLower.includes('ticket')) {
      relevantSections.push('ticketSummary')
      response += ` El resumen del ticket describe: ${currentCanvas.ticketSummary.problem || 'problema no especificado'}.`
      
      if (currentCanvas.ticketSummary.problem) {
        citations.push({
          section: 'ticketSummary',
          content: currentCanvas.ticketSummary.problem,
          relevance: 'high'
        })
      }
    }
    
    // Generic response if nothing specific detected
    if (response === '') {
      response = `El lienzo QA actual contiene ${this.getTotalItems(currentCanvas)} elementos distribuidos en diferentes secciones. `
      response += `Incluye ${currentCanvas.acceptanceCriteria.length} criterios de aceptación y ${currentCanvas.testCases.length} casos de prueba.`
      relevantSections.push('acceptanceCriteria', 'testCases')
    }
    
    return {
      response: response.trim(),
      relevantSections: [...new Set(relevantSections)],
      citations,
      suggestedFollowUps: [
        '¿Te gustaría que explique algún criterio específico?',
        '¿Quieres saber más sobre los casos de prueba?',
        '¿Necesitas información sobre alguna sección en particular?'
      ],
      confidence: 0.6
    }
  }

  /**
   * Validate citations against actual canvas content
   */
  private validateCitations(
    citations: ContentCitation[],
    currentCanvas: QACanvasDocument
  ): ContentCitation[] {
    return citations.filter(citation => {
      switch (citation.section) {
        case 'acceptanceCriteria':
          return currentCanvas.acceptanceCriteria.some(ac => 
            ac.title.includes(citation.content) || 
            ac.description.includes(citation.content) ||
            citation.content.includes(ac.title)
          )
        case 'testCases':
          return currentCanvas.testCases.some(tc => {
            const scenario = tc.testCase.scenario || tc.testCase.title || ''
            return scenario.includes(citation.content) || citation.content.includes(scenario)
          })
        case 'ticketSummary':
          return currentCanvas.ticketSummary.problem?.includes(citation.content) ||
                 currentCanvas.ticketSummary.solution?.includes(citation.content) ||
                 currentCanvas.ticketSummary.context?.includes(citation.content) ||
                 citation.content.includes(currentCanvas.ticketSummary.problem || '') ||
                 citation.content.includes(currentCanvas.ticketSummary.solution || '')
        case 'configurationWarnings':
          return currentCanvas.configurationWarnings.some(w => 
            w.title.includes(citation.content) || 
            w.message.includes(citation.content) ||
            citation.content.includes(w.title)
          )
        default:
          return true
      }
    })
  }

  /**
   * Identify relevant sections based on response content
   */
  private identifyRelevantSections(
    response: string,
    currentCanvas: QACanvasDocument,
    existingSections: CanvasSection[]
  ): CanvasSection[] {
    const sections = new Set(existingSections)
    const responseLower = response.toLowerCase()
    
    if (responseLower.includes('criterios') || responseLower.includes('criteria')) {
      sections.add('acceptanceCriteria')
    }
    
    if (responseLower.includes('test') || responseLower.includes('prueba')) {
      sections.add('testCases')
    }
    
    if (responseLower.includes('resumen') || responseLower.includes('ticket') || responseLower.includes('problema')) {
      sections.add('ticketSummary')
    }
    
    if (responseLower.includes('advertencia') || responseLower.includes('configuración')) {
      sections.add('configurationWarnings')
    }
    
    return Array.from(sections)
  }

  /**
   * Enhance follow-up suggestions based on canvas content
   */
  private enhanceFollowUpSuggestions(
    existingSuggestions: string[],
    currentCanvas: QACanvasDocument
  ): string[] {
    const suggestions = [...existingSuggestions]
    
    // Add context-specific suggestions
    if (currentCanvas.acceptanceCriteria.length > 0 && !suggestions.some(s => s.includes('criterios'))) {
      suggestions.push('¿Quieres que analice la calidad de los criterios de aceptación?')
    }
    
    if (currentCanvas.testCases.length > 0 && !suggestions.some(s => s.includes('test'))) {
      suggestions.push('¿Te gustaría saber si los test cases cubren todos los criterios?')
    }
    
    if (currentCanvas.configurationWarnings.length > 0) {
      suggestions.push('¿Quieres que explique las advertencias de configuración?')
    }
    
    // Add methodology suggestions
    if (currentCanvas.testCases.length > 0) {
      const formats = this.getTestCaseFormats(currentCanvas)
      if (formats.length > 0) {
        suggestions.push(`¿Te interesa saber por qué se usa el formato ${formats[0]} para los test cases?`)
      }
    }
    
    return suggestions.slice(0, 5) // Limit to 5 suggestions
  }

  /**
   * Assess canvas complexity
   */
  private assessCanvasComplexity(currentCanvas: QACanvasDocument): string {
    const totalItems = this.getTotalItems(currentCanvas)
    
    if (totalItems > 15) return 'complejo'
    if (totalItems > 5) return 'medio'
    return 'simple'
  }

  /**
   * Get sections that have content
   */
  private getPopulatedSections(currentCanvas: QACanvasDocument): string[] {
    const populated: string[] = []
    
    if (currentCanvas.ticketSummary.problem) populated.push('Resumen')
    if (currentCanvas.acceptanceCriteria.length > 0) populated.push('Criterios')
    if (currentCanvas.testCases.length > 0) populated.push('Test Cases')
    if (currentCanvas.configurationWarnings.length > 0) populated.push('Advertencias')
    
    return populated
  }

  /**
   * Get total number of items in canvas
   */
  private getTotalItems(currentCanvas: QACanvasDocument): number {
    return currentCanvas.acceptanceCriteria.length + 
           currentCanvas.testCases.length +
           currentCanvas.configurationWarnings.length
  }

  /**
   * Get test case formats used in canvas
   */
  private getTestCaseFormats(currentCanvas: QACanvasDocument): string[] {
    const formats = new Set(currentCanvas.testCases.map(tc => tc.format))
    return Array.from(formats)
  }

  /**
   * Extract key topics from user message for better targeting
   */
  extractTopics(userMessage: string): {
    sections: CanvasSection[]
    keywords: string[]
    questionType: 'explanation' | 'analysis' | 'methodology' | 'general'
  } {
    const messageLower = userMessage.toLowerCase()
    const sections: CanvasSection[] = []
    const keywords: string[] = []
    
    // Detect sections
    if (messageLower.includes('criterios') || messageLower.includes('criteria')) {
      sections.push('acceptanceCriteria')
      keywords.push('criterios de aceptación')
    }
    
    if (messageLower.includes('test') || messageLower.includes('prueba')) {
      sections.push('testCases')
      keywords.push('casos de prueba')
    }
    
    if (messageLower.includes('resumen') || messageLower.includes('ticket')) {
      sections.push('ticketSummary')
      keywords.push('resumen del ticket')
    }
    
    if (messageLower.includes('advertencia') || messageLower.includes('configuración')) {
      sections.push('configurationWarnings')
      keywords.push('configuración')
    }
    
    // Detect question type
    let questionType: 'explanation' | 'analysis' | 'methodology' | 'general' = 'general'
    
    if (messageLower.includes('explica') || messageLower.includes('qué significa') || messageLower.includes('cómo funciona')) {
      questionType = 'explanation'
    } else if (messageLower.includes('está bien') || messageLower.includes('calidad') || messageLower.includes('completo')) {
      questionType = 'analysis'
    } else if (messageLower.includes('por qué') || messageLower.includes('metodología') || messageLower.includes('formato')) {
      questionType = 'methodology'
    }
    
    return { sections, keywords, questionType }
  }

  /**
   * Generate section-specific insights
   */
  generateSectionInsights(
    section: CanvasSection,
    currentCanvas: QACanvasDocument
  ): string {
    switch (section) {
      case 'acceptanceCriteria':
        const criteria = currentCanvas.acceptanceCriteria
        if (criteria.length === 0) return 'No hay criterios de aceptación definidos.'
        
        const priorities = criteria.reduce((acc, c) => {
          acc[c.priority] = (acc[c.priority] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        return `Hay ${criteria.length} criterios de aceptación. Distribución por prioridad: ${Object.entries(priorities).map(([p, c]) => `${c} ${p}`).join(', ')}.`
        
      case 'testCases':
        const testCases = currentCanvas.testCases
        if (testCases.length === 0) return 'No hay casos de prueba definidos.'
        
        const formats = this.getTestCaseFormats(currentCanvas)
        const categories = [...new Set(testCases.map(tc => tc.category))]
        
        return `Hay ${testCases.length} casos de prueba en formato ${formats.join(', ')}. Categorías: ${categories.join(', ')}.`
        
      case 'ticketSummary':
        const summary = currentCanvas.ticketSummary
        const parts = []
        if (summary.problem) parts.push('problema definido')
        if (summary.solution) parts.push('solución especificada')
        if (summary.context) parts.push('contexto proporcionado')
        
        return `El resumen del ticket tiene: ${parts.join(', ')}.`
        
      case 'configurationWarnings':
        const warnings = currentCanvas.configurationWarnings
        if (warnings.length === 0) return 'No hay advertencias de configuración.'
        
        const severities = warnings.reduce((acc, w) => {
          acc[w.severity] = (acc[w.severity] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        return `Hay ${warnings.length} advertencias de configuración. Por severidad: ${Object.entries(severities).map(([s, c]) => `${c} ${s}`).join(', ')}.`
        
      default:
        return 'Sección no reconocida.'
    }
  }
}