/**
 * SectionTargetDetector - Identifies which canvas sections need modification
 * Uses keyword matching and AI analysis to detect target sections with high accuracy
 */

import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { 
  SectionTargetResult, 
  CanvasSection 
} from './types'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import { 
  SECTION_KEYWORDS, 
  CONFIDENCE_THRESHOLDS 
} from './constants'
import { canvasSectionSchema } from './types'

/**
 * AI tool for section target detection
 */
const sectionTargetDetectionTool = tool({
  description: "Identify which canvas sections should be targeted for modification based on user message",
  parameters: z.object({
    primaryTargets: z.array(canvasSectionSchema).describe("Main sections that should be modified"),
    secondaryTargets: z.array(canvasSectionSchema).describe("Sections that might be affected indirectly"),
    confidence: z.number().min(0).max(1).describe("Confidence in section detection"),
    reasoning: z.string().describe("Explanation of why these sections were selected"),
    keywords: z.array(z.string()).describe("Key terms that influenced section selection"),
    detectionMethod: z.enum(['keyword', 'ai_analysis', 'hybrid']).describe("Method used for detection")
  })
})

/**
 * SectionTargetDetector class for identifying target canvas sections
 */
export class SectionTargetDetector {
  private readonly model = openai('gpt-4o-mini')

  /**
   * Detect target sections from user message and canvas context
   */
  async detectTargetSections(
    userMessage: string,
    currentCanvas?: QACanvasDocument
  ): Promise<SectionTargetResult> {
    try {
      // Perform keyword-based detection first
      const keywordResult = this.performKeywordDetection(userMessage)
      
      // If keyword detection has high confidence, use it
      if (keywordResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE) {
        return keywordResult
      }
      
      // Otherwise, use AI analysis for more nuanced detection
      const aiResult = await this.performAIDetection(userMessage, currentCanvas, keywordResult)
      
      // Combine results for best accuracy
      return this.combineDetectionResults(keywordResult, aiResult)
      
    } catch (error) {
      console.error('Section target detection failed:', error)
      return this.createFallbackResult(userMessage, error as Error)
    }
  }

  /**
   * Perform keyword-based section detection
   */
  private performKeywordDetection(userMessage: string): SectionTargetResult {
    const messageLower = userMessage.toLowerCase()
    const detectedKeywords: string[] = []
    const sectionScores: Record<CanvasSection, number> = {
      ticketSummary: 0,
      acceptanceCriteria: 0,
      testCases: 0,
      configurationWarnings: 0,
      metadata: 0
    }

    // Score each section based on keyword matches
    for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
      const sectionKey = section as CanvasSection
      let sectionScore = 0
      
      for (const keyword of keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          // Weight longer keywords more heavily
          const weight = keyword.length > 10 ? 2 : 1
          sectionScore += weight
          detectedKeywords.push(keyword)
        }
      }
      
      sectionScores[sectionKey] = sectionScore
    }

    // Determine primary and secondary targets
    const sortedSections = Object.entries(sectionScores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score > 0)

    const primaryTargets: CanvasSection[] = []
    const secondaryTargets: CanvasSection[] = []

    // Primary targets: sections with highest scores
    const maxScore = sortedSections[0]?.[1] || 0
    const highThreshold = maxScore * 0.8

    for (const [section, score] of sortedSections) {
      if (score >= highThreshold && primaryTargets.length < 3) {
        primaryTargets.push(section as CanvasSection)
      } else if (score > 0 && secondaryTargets.length < 2) {
        secondaryTargets.push(section as CanvasSection)
      }
    }

    // Calculate confidence based on keyword matches
    const totalMatches = Object.values(sectionScores).reduce((sum, score) => sum + score, 0)
    const confidence = Math.min(0.95, Math.max(0.1, totalMatches * 0.2))

    return {
      primaryTargets,
      secondaryTargets,
      keywords: [...new Set(detectedKeywords)],
      confidence,
      detectionMethod: 'keyword'
    }
  }

  /**
   * Perform AI-based section detection
   */
  private async performAIDetection(
    userMessage: string,
    currentCanvas?: QACanvasDocument,
    keywordHints?: SectionTargetResult
  ): Promise<SectionTargetResult> {
    
    const systemPrompt = this.buildSystemPrompt(currentCanvas, keywordHints)
    
    try {
      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: `
Analiza el siguiente mensaje del usuario e identifica qué secciones del lienzo QA necesitan ser modificadas:

Mensaje del usuario: "${userMessage}"

${currentCanvas ? `
Estado actual del lienzo:
- Resumen del ticket: ${currentCanvas.ticketSummary.problem ? 'Presente' : 'Ausente'}
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length} items
- Casos de prueba: ${currentCanvas.testCases.length} items
- Advertencias de configuración: ${currentCanvas.configurationWarnings.length} items
` : 'No hay lienzo disponible actualmente.'}

Pistas del análisis de palabras clave:
- Objetivos primarios sugeridos: ${keywordHints?.primaryTargets.join(', ') || 'Ninguno'}
- Objetivos secundarios sugeridos: ${keywordHints?.secondaryTargets.join(', ') || 'Ninguno'}
- Palabras clave detectadas: ${keywordHints?.keywords.join(', ') || 'Ninguna'}
- Confianza de palabras clave: ${keywordHints?.confidence || 0}

Identifica las secciones objetivo con alta precisión.
        `,
        tools: { sectionTargetDetection: sectionTargetDetectionTool },
        toolChoice: 'required',
        maxTokens: 800,
        temperature: 0.1
      })

      const toolCall = result.toolCalls[0]
      if (toolCall?.toolName === 'sectionTargetDetection') {
        const args = toolCall.args
        return {
          primaryTargets: args.primaryTargets,
          secondaryTargets: args.secondaryTargets,
          keywords: args.keywords,
          confidence: args.confidence,
          detectionMethod: 'ai_analysis'
        }
      }
      
      throw new Error('AI detection did not return expected tool call')
      
    } catch (error) {
      console.error('AI section detection failed:', error)
      // Return keyword result as fallback
      return keywordHints || this.createEmptyResult()
    }
  }

  /**
   * Build system prompt for AI detection
   */
  private buildSystemPrompt(
    currentCanvas?: QACanvasDocument,
    keywordHints?: SectionTargetResult
  ): string {
    return `
Eres un experto en análisis de documentación QA que identifica qué secciones de un lienzo necesitan modificación.

Las secciones disponibles son:

1. **ticketSummary**: Resumen del ticket (problema, solución, contexto)
   - Indicadores: "resumen", "explicación", "descripción", "contexto", "problema", "solución"

2. **acceptanceCriteria**: Criterios de aceptación
   - Indicadores: "criterios de aceptación", "criterios", "requisitos", "condiciones"

3. **testCases**: Casos de prueba
   - Indicadores: "test cases", "casos de prueba", "pruebas", "tests", "escenarios"

4. **configurationWarnings**: Advertencias de configuración
   - Indicadores: "configuración", "advertencias", "warnings", "conflictos"

5. **metadata**: Metadatos del documento
   - Indicadores: "metadata", "metadatos", "información", "detalles"

REGLAS IMPORTANTES:

1. **Objetivos Primarios**: Secciones que el usuario menciona explícitamente o que son el foco principal
2. **Objetivos Secundarios**: Secciones que podrían verse afectadas indirectamente

3. **Dependencias importantes**:
   - Si se modifican criterios de aceptación → los test cases podrían necesitar actualización
   - Si se modifica el resumen del ticket → criterios y test cases podrían verse afectados

4. **Confianza**:
   - Alta (0.8+): Mención explícita de secciones específicas
   - Media (0.5-0.8): Implicación clara pero no explícita
   - Baja (0.2-0.5): Inferencia basada en contexto
   - Muy baja (<0.2): Adivinanza

5. **Límites**:
   - Máximo 3 objetivos primarios
   - Máximo 2 objetivos secundarios
   - Prioriza calidad sobre cantidad

Contexto del lienzo actual:
${currentCanvas ? `
- Tiene resumen: ${currentCanvas.ticketSummary.problem ? 'Sí' : 'No'}
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length}
- Casos de prueba: ${currentCanvas.testCases.length}
- Advertencias: ${currentCanvas.configurationWarnings.length}
` : 'No hay lienzo disponible'}
    `
  }

  /**
   * Combine keyword and AI detection results
   */
  private combineDetectionResults(
    keywordResult: SectionTargetResult,
    aiResult: SectionTargetResult
  ): SectionTargetResult {
    // Combine primary targets (AI takes precedence)
    const primaryTargets = aiResult.primaryTargets.length > 0 
      ? aiResult.primaryTargets 
      : keywordResult.primaryTargets

    // Combine secondary targets
    const allSecondaryTargets = [
      ...aiResult.secondaryTargets,
      ...keywordResult.secondaryTargets
    ]
    const secondaryTargets = [...new Set(allSecondaryTargets)]
      .filter(section => !primaryTargets.includes(section))
      .slice(0, 2) // Limit to 2

    // Combine keywords
    const keywords = [...new Set([
      ...aiResult.keywords,
      ...keywordResult.keywords
    ])]

    // Use higher confidence
    const confidence = Math.max(aiResult.confidence, keywordResult.confidence)

    return {
      primaryTargets,
      secondaryTargets,
      keywords,
      confidence,
      detectionMethod: 'hybrid'
    }
  }

  /**
   * Create fallback result when detection fails
   */
  private createFallbackResult(userMessage: string, error: Error): SectionTargetResult {
    console.warn('Using fallback section detection due to error:', error.message)
    
    // Simple fallback: try to detect any section keywords
    const messageLower = userMessage.toLowerCase()
    const fallbackTargets: CanvasSection[] = []
    
    if (messageLower.includes('criterios') || messageLower.includes('criteria')) {
      fallbackTargets.push('acceptanceCriteria')
    }
    if (messageLower.includes('test') || messageLower.includes('prueba')) {
      fallbackTargets.push('testCases')
    }
    if (messageLower.includes('resumen') || messageLower.includes('summary')) {
      fallbackTargets.push('ticketSummary')
    }
    
    return {
      primaryTargets: fallbackTargets.slice(0, 1),
      secondaryTargets: fallbackTargets.slice(1, 2),
      keywords: [],
      confidence: CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE,
      detectionMethod: 'keyword'
    }
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): SectionTargetResult {
    return {
      primaryTargets: [],
      secondaryTargets: [],
      keywords: [],
      confidence: 0,
      detectionMethod: 'keyword'
    }
  }

  /**
   * Validate detected sections against available canvas sections
   */
  validateSections(
    result: SectionTargetResult,
    currentCanvas?: QACanvasDocument
  ): SectionTargetResult {
    if (!currentCanvas) {
      return result
    }

    // Filter out sections that don't make sense for current canvas state
    const validPrimaryTargets = result.primaryTargets.filter(section => {
      switch (section) {
        case 'ticketSummary':
          return true // Always valid
        case 'acceptanceCriteria':
          return true // Always valid
        case 'testCases':
          return true // Always valid
        case 'configurationWarnings':
          return currentCanvas.configurationWarnings.length > 0
        case 'metadata':
          return false // Usually not user-modifiable
        default:
          return true
      }
    })

    const validSecondaryTargets = result.secondaryTargets.filter(section => 
      !validPrimaryTargets.includes(section)
    )

    return {
      ...result,
      primaryTargets: validPrimaryTargets,
      secondaryTargets: validSecondaryTargets
    }
  }

  /**
   * Get section display names for user communication
   */
  getSectionDisplayNames(sections: CanvasSection[], language: 'es' | 'en' = 'es'): string[] {
    const displayNames = {
      es: {
        ticketSummary: 'Resumen del ticket',
        acceptanceCriteria: 'Criterios de aceptación',
        testCases: 'Casos de prueba',
        configurationWarnings: 'Advertencias de configuración',
        metadata: 'Metadatos'
      },
      en: {
        ticketSummary: 'Ticket summary',
        acceptanceCriteria: 'Acceptance criteria',
        testCases: 'Test cases',
        configurationWarnings: 'Configuration warnings',
        metadata: 'Metadata'
      }
    }

    return sections.map(section => displayNames[language][section])
  }
}