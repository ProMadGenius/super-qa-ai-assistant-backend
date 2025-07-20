/**
 * IntentAnalyzer - Core component for analyzing user intent in QA conversations
 * Determines whether user wants to modify canvas, ask for clarification, get information, or is off-topic
 */

import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { UIMessage } from 'ai'
import type {
  IntentAnalysisResult,
  IntentType,
  CanvasSection,
  AnalysisContext,
  IntentAnalysisError
} from './types'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import {
  INTENT_KEYWORDS,
  SECTION_KEYWORDS
} from './constants'
import {
  intentTypeSchema,
  canvasSectionSchema,
  intentAnalysisResultSchema
} from './types'

/**
 * AI tool for intent classification
 */
const intentClassificationTool = tool({
  description: "Classify user intent for QA canvas interactions with high accuracy",
  parameters: z.object({
    intent: intentTypeSchema.describe("Primary intent classification"),
    confidence: z.number().min(0).max(1).describe("Confidence score for classification"),
    targetSections: z.array(canvasSectionSchema).describe("Canvas sections that would be affected"),
    reasoning: z.string().describe("Detailed explanation of classification decision"),
    keywords: z.array(z.string()).describe("Key terms that influenced classification"),
    shouldModifyCanvas: z.boolean().describe("Whether this intent requires canvas modification"),
    requiresClarification: z.boolean().describe("Whether clarification is needed before proceeding")
  })
})

/**
 * IntentAnalyzer class for analyzing user messages and determining intent
 */
export class IntentAnalyzer {
  private readonly model = openai('gpt-4o-mini')

  /**
   * Analyze user intent from message and context
   */
  async analyzeIntent(
    userMessage: string,
    conversationHistory: UIMessage[],
    currentCanvas?: QACanvasDocument
  ): Promise<IntentAnalysisResult> {
    try {
      // Build analysis context
      const context = this.buildAnalysisContext(conversationHistory, currentCanvas)

      // Perform keyword-based pre-analysis
      const keywordAnalysis = this.performKeywordAnalysis(userMessage)

      // Use AI for detailed intent classification
      const aiAnalysis = await this.performAIAnalysis(
        userMessage,
        conversationHistory,
        currentCanvas,
        context,
        keywordAnalysis
      )

      // Combine keyword and AI analysis
      const finalResult = this.combineAnalysisResults(keywordAnalysis, aiAnalysis, context)

      // Validate result
      const validationResult = intentAnalysisResultSchema.safeParse(finalResult)
      if (!validationResult.success) {
        throw new Error(`Intent analysis result validation failed: ${validationResult.error.message}`)
      }

      return finalResult

    } catch (error) {
      console.error('Intent analysis failed:', error)
      return this.createFallbackResult(userMessage, error as Error)
    }
  }

  /**
   * Build analysis context from conversation and canvas
   */
  private buildAnalysisContext(
    conversationHistory: UIMessage[],
    currentCanvas?: QACanvasDocument
  ): AnalysisContext {
    const hasCanvas = !!currentCanvas
    const conversationLength = conversationHistory.length

    // Determine canvas complexity
    let canvasComplexity: 'simple' | 'medium' | 'complex' = 'simple'
    if (currentCanvas) {
      const totalItems =
        currentCanvas.acceptanceCriteria.length +
        currentCanvas.testCases.length +
        currentCanvas.configurationWarnings.length

      if (totalItems > 15) canvasComplexity = 'complex'
      else if (totalItems > 5) canvasComplexity = 'medium'
    }

    // Get available sections
    const availableSections: CanvasSection[] = hasCanvas
      ? ['ticketSummary', 'acceptanceCriteria', 'testCases', 'configurationWarnings', 'metadata']
      : []

    // Get last user intent from conversation
    const lastUserIntent = this.extractLastUserIntent(conversationHistory)

    return {
      hasCanvas,
      canvasComplexity,
      conversationLength,
      lastUserIntent,
      availableSections
    }
  }

  /**
   * Perform keyword-based analysis for quick classification
   */
  private performKeywordAnalysis(userMessage: string): Partial<IntentAnalysisResult> {
    const messageLower = userMessage.toLowerCase()
    const detectedKeywords: string[] = []
    const targetSections: CanvasSection[] = []

    // Check for intent keywords
    let likelyIntent: IntentType | null = null
    let maxKeywordMatches = 0

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const matches = keywords.filter(keyword => messageLower.includes(keyword.toLowerCase()))
      if (matches.length > maxKeywordMatches) {
        maxKeywordMatches = matches.length
        likelyIntent = intent as IntentType
        detectedKeywords.push(...matches)
      }
    }

    // Check for section keywords
    for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
      const matches = keywords.filter(keyword => messageLower.includes(keyword.toLowerCase()))
      if (matches.length > 0) {
        targetSections.push(section as CanvasSection)
        detectedKeywords.push(...matches)
      }
    }

    // Be more decisive - if we have any section keywords, assume modification intent
    if (targetSections.length > 0 && !likelyIntent) {
      likelyIntent = 'modify_canvas'
      maxKeywordMatches = Math.max(maxKeywordMatches, 1)
    }

    // If no specific intent but message seems like a complaint/request, assume modification
    if (!likelyIntent && this.seemsLikeModificationRequest(messageLower)) {
      likelyIntent = 'modify_canvas'
      maxKeywordMatches = Math.max(maxKeywordMatches, 1)
      // If no specific sections, assume they want to modify acceptance criteria (most common)
      if (targetSections.length === 0) {
        targetSections.push('acceptanceCriteria')
      }
    }

    // Determine confidence - be more confident in our decisions
    const confidence = Math.min(0.9, Math.max(0.6, maxKeywordMatches * 0.3 + 0.4))

    return {
      intent: likelyIntent || 'modify_canvas', // Default to modification instead of clarification
      confidence,
      targetSections,
      keywords: [...new Set(detectedKeywords)], // Remove duplicates
      shouldModifyCanvas: (likelyIntent === 'modify_canvas') || (!likelyIntent && targetSections.length > 0),
      requiresClarification: false // Be less likely to require clarification
    }
  }

  /**
   * Check if message seems like a modification request even without specific keywords
   */
  private seemsLikeModificationRequest(messageLower: string): boolean {
    const modificationIndicators = [
      // Spanish indicators
      'mal', 'incorrecto', 'error', 'problema', 'falta', 'necesita', 'debería', 'mejor',
      'cambio', 'actualiza', 'corrige', 'mejora', 'agrega', 'quita', 'elimina',
      // English indicators  
      'wrong', 'incorrect', 'error', 'problem', 'missing', 'needs', 'should', 'better',
      'change', 'update', 'fix', 'improve', 'add', 'remove', 'delete'
    ]

    return modificationIndicators.some(indicator => messageLower.includes(indicator))
  }

  /**
   * Perform AI-based analysis for detailed classification
   */
  private async performAIAnalysis(
    userMessage: string,
    conversationHistory: UIMessage[],
    currentCanvas?: QACanvasDocument,
    context?: AnalysisContext,
    keywordHints?: Partial<IntentAnalysisResult>
  ): Promise<Partial<IntentAnalysisResult>> {

    const systemPrompt = this.buildSystemPrompt(currentCanvas, context, keywordHints)
    const conversationContext = this.buildConversationContext(conversationHistory)

    try {
      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: `
Analiza el siguiente mensaje del usuario y clasifica su intención:

Mensaje del usuario: "${userMessage}"

Contexto de la conversación:
${conversationContext}

${currentCanvas ? `
Estado actual del lienzo:
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length} items
- Casos de prueba: ${currentCanvas.testCases.length} items
- Advertencias: ${currentCanvas.configurationWarnings.length} items
- Resumen del ticket: ${currentCanvas.ticketSummary.problem ? 'Presente' : 'Ausente'}
` : 'No hay lienzo actual disponible.'}

Pistas del análisis de palabras clave:
- Intención sugerida: ${keywordHints?.intent || 'No detectada'}
- Secciones objetivo: ${keywordHints?.targetSections?.join(', ') || 'Ninguna'}
- Palabras clave: ${keywordHints?.keywords?.join(', ') || 'Ninguna'}

Clasifica la intención y proporciona un análisis detallado.
        `,
        tools: { intentClassification: intentClassificationTool },
        toolChoice: 'required',
        maxTokens: 1000,
        temperature: 0.1
      })

      const toolCall = result.toolCalls[0]
      if (toolCall?.toolName === 'intentClassification') {
        return toolCall.args as Partial<IntentAnalysisResult>
      }

      throw new Error('AI analysis did not return expected tool call')

    } catch (error) {
      console.error('AI analysis failed:', error)
      // Return keyword analysis as fallback
      return keywordHints || {}
    }
  }

  /**
   * Build system prompt for AI analysis
   */
  private buildSystemPrompt(
    currentCanvas?: QACanvasDocument,
    context?: AnalysisContext,
    keywordHints?: Partial<IntentAnalysisResult>
  ): string {
    return `
Eres un experto analista de intenciones para un sistema de QA que ayuda a analizar tickets de Jira y generar documentación de pruebas.

Tu trabajo es clasificar la intención del usuario de manera DECISIVA y PRÁCTICA. Evita pedir clarificación a menos que sea absolutamente necesario.

CATEGORÍAS DE INTENCIÓN:

1. **modify_canvas**: El usuario quiere modificar el contenido del lienzo (criterios, test cases, etc.)
   - Indicadores: "cambiar", "modificar", "actualizar", "corregir", "mejorar", "mal", "incorrecto", "error", "problema", "falta", "necesita", "debería", "mejor"
   - ESTA ES LA INTENCIÓN MÁS COMÚN - cuando hay duda, elige esta

2. **ask_clarification**: SOLO cuando el usuario es extremadamente vago y no hay forma de inferir qué quiere
   - Indicadores: mensajes de una sola palabra como "mal" sin contexto
   - USA ESTA CATEGORÍA MUY RARAMENTE

3. **provide_information**: El usuario quiere información sin modificar el documento
   - Indicadores: "¿qué significa?", "explícame", "¿cómo funciona?", "¿qué es?"
   - Preguntas directas sobre contenido existente

4. **request_explanation**: El usuario quiere explicación del contenido existente
   - Indicadores: "explica", "ayúdame a entender", "¿por qué?"
   - Similar a provide_information pero más específico sobre explicaciones

5. **off_topic**: El usuario pregunta sobre temas no relacionados con QA/testing
   - Indicadores: deportes, clima, comida, entretenimiento, etc.

REGLAS CRÍTICAS:
- SÉ DECISIVO: Si hay cualquier indicación de que quieren cambiar algo → modify_canvas
- NO PIDAS CLARIFICACIÓN a menos que el mensaje sea completamente incomprensible
- Si mencionan cualquier sección (criterios, test cases, etc.) → modify_canvas
- Si dicen que algo "está mal", "es incorrecto", "tiene errores" → modify_canvas
- Si no especifican sección pero quieren cambios → asume acceptanceCriteria (más común)
- Confianza alta (0.7+) para decisiones claras
- requiresClarification = false en 95% de los casos

EJEMPLOS DE DECISIONES CORRECTAS:
- "Los criterios están mal" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.8
- "Esto no está bien" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.7
- "Falta información" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.7
- "Necesita mejoras" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.7

Contexto actual:
${context ? `
- Tiene lienzo: ${context.hasCanvas}
- Complejidad: ${context.canvasComplexity}
- Longitud conversación: ${context.conversationLength}
- Secciones disponibles: ${context.availableSections.join(', ')}
` : 'Sin contexto disponible'}

Pistas del análisis de palabras clave: ${keywordHints?.intent || 'modify_canvas'}
    `
  }

  /**
   * Build conversation context string
   */
  private buildConversationContext(conversationHistory: UIMessage[]): string {
    if (conversationHistory.length === 0) {
      return 'Esta es la primera interacción.'
    }

    const recentMessages = conversationHistory.slice(-4) // Last 4 messages
    return recentMessages
      .map((msg, index) => `${msg.role}: ${this.extractTextFromMessage(msg)}`)
      .join('\n')
  }

  /**
   * Extract text content from UI message
   */
  private extractTextFromMessage(message: UIMessage): string {
    const content = message.content as any
    
    if (typeof content === 'string') {
      return content
    }

    // Handle array content (for complex message types)
    if (Array.isArray(content)) {
      const parts = content as any[]
      return parts
        .filter((part: any) => part && part.type === 'text')
        .map((part: any) => part.text || '')
        .join(' ')
    }

    return '[No text content]'
  }

  /**
   * Extract last user intent from conversation history
   */
  private extractLastUserIntent(conversationHistory: UIMessage[]): IntentType | undefined {
    // This is a simplified implementation
    // In a real system, you might store intent metadata in message metadata
    const lastUserMessage = conversationHistory
      .filter(msg => msg.role === 'user')
      .pop()

    if (!lastUserMessage) return undefined

    // Simple keyword-based detection for last intent
    const messageText = this.extractTextFromMessage(lastUserMessage).toLowerCase()

    if (INTENT_KEYWORDS.modify_canvas.some(keyword => messageText.includes(keyword))) {
      return 'modify_canvas'
    }
    if (INTENT_KEYWORDS.provide_information.some(keyword => messageText.includes(keyword))) {
      return 'provide_information'
    }

    return undefined
  }

  /**
   * Combine keyword and AI analysis results
   */
  private combineAnalysisResults(
    keywordAnalysis: Partial<IntentAnalysisResult>,
    aiAnalysis: Partial<IntentAnalysisResult>,
    context: AnalysisContext
  ): IntentAnalysisResult {
    // AI analysis takes precedence, but we use keyword analysis as fallback
    const intent = aiAnalysis.intent || keywordAnalysis.intent || 'ask_clarification'
    const confidence = Math.max(
      aiAnalysis.confidence || 0,
      keywordAnalysis.confidence || 0
    )

    // Combine target sections from both analyses
    const targetSections = [
      ...(aiAnalysis.targetSections || []),
      ...(keywordAnalysis.targetSections || [])
    ]
    const uniqueTargetSections = [...new Set(targetSections)]

    // Combine keywords
    const keywords = [
      ...(aiAnalysis.keywords || []),
      ...(keywordAnalysis.keywords || [])
    ]
    const uniqueKeywords = [...new Set(keywords)]

    return {
      intent,
      confidence: Math.min(confidence, 1.0),
      targetSections: uniqueTargetSections,
      context,
      reasoning: aiAnalysis.reasoning || keywordAnalysis.reasoning || 'Combined keyword and AI analysis',
      keywords: uniqueKeywords,
      shouldModifyCanvas: aiAnalysis.shouldModifyCanvas ?? keywordAnalysis.shouldModifyCanvas ?? false,
      requiresClarification: aiAnalysis.requiresClarification ?? keywordAnalysis.requiresClarification ?? false
    }
  }

  /**
   * Create fallback result when analysis fails
   */
  private createFallbackResult(userMessage: string, error: Error): IntentAnalysisResult {
    console.warn('Using fallback intent analysis due to error:', error.message)

    // Even in fallback, try to be decisive - assume modification intent
    const messageLower = userMessage.toLowerCase()
    const seemsLikeModification = this.seemsLikeModificationRequest(messageLower)

    return {
      intent: seemsLikeModification ? 'modify_canvas' : 'modify_canvas', // Always default to modification
      confidence: seemsLikeModification ? 0.6 : 0.5,
      targetSections: ['acceptanceCriteria'], // Default to most common section
      context: {
        hasCanvas: false,
        canvasComplexity: 'simple',
        conversationLength: 0,
        availableSections: []
      },
      reasoning: `Fallback analysis due to error: ${error.message}. Defaulting to canvas modification.`,
      keywords: [],
      shouldModifyCanvas: true,
      requiresClarification: false // Don't require clarification even in fallback
    }
  }


}