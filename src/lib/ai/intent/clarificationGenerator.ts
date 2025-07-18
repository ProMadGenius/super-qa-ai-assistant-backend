/**
 * ClarificationGenerator - Generates specific clarification questions
 * Creates targeted questions when user requests are vague or ambiguous
 */

import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { 
  ClarificationResult, 
  ClarificationQuestion,
  ClarificationCategory,
  CanvasSection 
} from './types'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import { TEMPLATE_CLARIFICATION_QUESTIONS } from './constants'
import { canvasSectionSchema } from './types'

/**
 * AI tool for clarification question generation
 */
const clarificationGenerationTool = tool({
  description: "Generate specific clarification questions to understand user's vague or ambiguous requests",
  parameters: z.object({
    questions: z.array(z.object({
      question: z.string().describe("The clarification question to ask"),
      category: z.enum(['specification', 'scope', 'priority', 'format', 'dependency']).describe("Category of the question"),
      targetSection: canvasSectionSchema.describe("Section this question relates to"),
      examples: z.array(z.string()).optional().describe("Example answers or options"),
      priority: z.enum(['high', 'medium', 'low']).describe("Priority of this question")
    })).describe("List of clarification questions"),
    context: z.string().describe("Context explanation for why these questions are needed"),
    suggestedActions: z.array(z.string()).describe("Suggested actions the user could take"),
    estimatedTime: z.number().describe("Estimated time in minutes to resolve clarification")
  })
})

/**
 * ClarificationGenerator class for generating targeted questions
 */
export class ClarificationGenerator {
  private readonly model = openai('gpt-4o-mini')

  /**
   * Generate clarification questions for ambiguous user requests
   */
  async generateClarificationQuestions(
    userMessage: string,
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument
  ): Promise<ClarificationResult> {
    try {
      // Try AI-powered generation first
      const aiResult = await this.performAIGeneration(userMessage, targetSections, currentCanvas)
      
      // If AI generation fails or produces insufficient questions, use templates
      if (!aiResult || aiResult.questions.length === 0) {
        return this.generateTemplateQuestions(userMessage, targetSections, currentCanvas)
      }
      
      return aiResult
      
    } catch (error) {
      console.error('Clarification generation failed:', error)
      return this.generateTemplateQuestions(userMessage, targetSections, currentCanvas)
    }
  }

  /**
   * Perform AI-powered clarification generation
   */
  private async performAIGeneration(
    userMessage: string,
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument
  ): Promise<ClarificationResult> {
    
    const systemPrompt = this.buildSystemPrompt(currentCanvas, targetSections)
    
    const result = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: `
El usuario ha enviado un mensaje vago o ambiguo que requiere clarificación:

Mensaje del usuario: "${userMessage}"
Secciones objetivo detectadas: ${targetSections.join(', ') || 'Ninguna específica'}

Estado actual del lienzo:
- Resumen del ticket: ${currentCanvas.ticketSummary.problem ? 'Presente' : 'Ausente'}
- Criterios de aceptación: ${currentCanvas.acceptanceCriteria.length} items
- Casos de prueba: ${currentCanvas.testCases.length} items
- Advertencias: ${currentCanvas.configurationWarnings.length} items

Genera preguntas específicas y útiles para entender exactamente qué quiere cambiar el usuario.
      `,
      tools: { clarificationGeneration: clarificationGenerationTool },
      toolChoice: 'required',
      maxTokens: 1200,
      temperature: 0.2
    })

    const toolCall = result.toolCalls[0]
    if (toolCall?.toolName === 'clarificationGeneration') {
      const args = toolCall.args
      return {
        questions: args.questions.map(q => ({
          question: q.question,
          category: q.category,
          targetSection: q.targetSection,
          examples: q.examples || [],
          priority: q.priority
        })),
        context: args.context,
        suggestedActions: args.suggestedActions,
        estimatedClarificationTime: args.estimatedTime
      }
    }
    
    throw new Error('AI clarification generation did not return expected tool call')
  }

  /**
   * Build system prompt for AI generation
   */
  private buildSystemPrompt(
    currentCanvas: QACanvasDocument,
    targetSections: CanvasSection[]
  ): string {
    return `
Eres un experto en análisis de requerimientos QA que genera preguntas de clarificación específicas y útiles.

Tu trabajo es ayudar a entender exactamente qué quiere cambiar el usuario cuando su mensaje es vago o ambiguo.

TIPOS DE PREGUNTAS DE CLARIFICACIÓN:

1. **specification**: Qué específicamente necesita cambiar
   - "¿Qué aspecto específico de los criterios de aceptación está mal?"
   - "¿Puedes darme un ejemplo de lo que debería decir?"

2. **scope**: Qué alcance tienen los cambios
   - "¿Quieres que modifique solo esta sección o también las relacionadas?"
   - "¿Este cambio afecta todos los criterios o solo algunos específicos?"

3. **priority**: Qué es más importante
   - "¿Cuál es el problema más crítico que necesita arreglarse?"
   - "¿Qué cambio tendría mayor impacto?"

4. **format**: Cómo quiere que se presente
   - "¿Prefieres que los test cases estén en formato Gherkin o pasos?"
   - "¿Quieres más detalle o más concisión?"

5. **dependency**: Cómo afecta otras secciones
   - "¿Si cambio los criterios, también debo actualizar los test cases?"
   - "¿Este cambio requiere modificar el resumen del ticket?"

REGLAS PARA GENERAR PREGUNTAS:

1. **Específicas**: Evita preguntas genéricas como "¿Qué quieres cambiar?"
2. **Accionables**: Cada pregunta debe llevar a una acción concreta
3. **Contextualizadas**: Usa el contenido actual del lienzo
4. **Limitadas**: Máximo 4 preguntas para no abrumar al usuario
5. **Priorizadas**: Ordena por importancia (high, medium, low)

CONTEXTO DEL LIENZO ACTUAL:
- Complejidad: ${this.assessCanvasComplexity(currentCanvas)}
- Secciones con contenido: ${this.getPopulatedSections(currentCanvas).join(', ')}
- Secciones objetivo: ${targetSections.join(', ') || 'No específicas'}

EJEMPLOS DE BUENAS PREGUNTAS:
- "¿Qué criterio específico de los ${currentCanvas.acceptanceCriteria.length} existentes necesita cambiar?"
- "¿El problema está en la redacción, el contenido, o faltan criterios?"
- "¿Quieres que los test cases se actualicen automáticamente si cambio los criterios?"
    `
  }

  /**
   * Generate template-based clarification questions
   */
  private generateTemplateQuestions(
    userMessage: string,
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument
  ): ClarificationResult {
    const questions: ClarificationQuestion[] = []
    const messageLower = userMessage.toLowerCase()
    
    // Detect the type of vague complaint
    let questionType: 'vague_complaint' | 'missing_context' | 'scope_clarification' = 'missing_context'
    
    if (messageLower.includes('mal') || messageLower.includes('wrong') || 
        messageLower.includes('incorrecto') || messageLower.includes('incorrect')) {
      questionType = 'vague_complaint'
    } else if (targetSections.length > 1) {
      questionType = 'scope_clarification'
    }
    
    // Generate questions based on type and target sections
    if (targetSections.length === 0) {
      // No specific sections detected
      questions.push({
        question: "¿Qué sección específica del lienzo necesita cambios: criterios de aceptación, casos de prueba, o el resumen del ticket?",
        category: 'scope',
        targetSection: 'acceptanceCriteria', // Default
        examples: ['Criterios de aceptación', 'Casos de prueba', 'Resumen del ticket'],
        priority: 'high'
      })
    } else {
      // Generate questions for each target section
      for (const section of targetSections.slice(0, 2)) { // Limit to 2 sections
        questions.push(...this.generateSectionSpecificQuestions(section, questionType, currentCanvas))
      }
    }
    
    // Add dependency question if multiple sections involved
    if (targetSections.length > 1 || 
        (targetSections.includes('acceptanceCriteria') && currentCanvas.testCases.length > 0)) {
      questions.push({
        question: "¿Si modifico los criterios de aceptación, también debo actualizar los casos de prueba relacionados?",
        category: 'dependency',
        targetSection: 'testCases',
        examples: ['Sí, actualizar automáticamente', 'No, mantener como están', 'Revisar manualmente después'],
        priority: 'medium'
      })
    }
    
    // Limit to 4 questions maximum
    const limitedQuestions = questions.slice(0, 4)
    
    return {
      questions: limitedQuestions,
      context: this.generateContextExplanation(userMessage, targetSections, questionType),
      suggestedActions: this.generateSuggestedActions(targetSections, currentCanvas),
      estimatedClarificationTime: Math.min(5, limitedQuestions.length * 2)
    }
  }

  /**
   * Generate section-specific clarification questions
   */
  private generateSectionSpecificQuestions(
    section: CanvasSection,
    questionType: 'vague_complaint' | 'missing_context' | 'scope_clarification',
    currentCanvas: QACanvasDocument
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = []
    
    switch (section) {
      case 'acceptanceCriteria':
        if (questionType === 'vague_complaint') {
          questions.push({
            question: `¿Qué específicamente está mal en los ${currentCanvas.acceptanceCriteria.length} criterios de aceptación actuales?`,
            category: 'specification',
            targetSection: section,
            examples: ['Muy vagos', 'Faltan detalles técnicos', 'No son testables', 'Faltan casos edge'],
            priority: 'high'
          })
        } else {
          questions.push({
            question: "¿Qué aspecto de los criterios de aceptación necesita mejorar?",
            category: 'specification',
            targetSection: section,
            examples: ['Agregar más detalle', 'Simplificar redacción', 'Agregar nuevos criterios', 'Reorganizar prioridades'],
            priority: 'high'
          })
        }
        break
        
      case 'testCases':
        if (questionType === 'vague_complaint') {
          questions.push({
            question: `¿Qué problema específico ves en los ${currentCanvas.testCases.length} casos de prueba actuales?`,
            category: 'specification',
            targetSection: section,
            examples: ['No cubren todos los escenarios', 'Muy complejos', 'Faltan casos negativos', 'Formato incorrecto'],
            priority: 'high'
          })
        } else {
          questions.push({
            question: "¿Qué tipo de cambios necesitas en los casos de prueba?",
            category: 'specification',
            targetSection: section,
            examples: ['Agregar más casos', 'Cambiar formato', 'Simplificar pasos', 'Agregar casos edge'],
            priority: 'high'
          })
        }
        break
        
      case 'ticketSummary':
        questions.push({
          question: "¿Qué parte del resumen del ticket necesita actualización?",
          category: 'specification',
          targetSection: section,
          examples: ['Descripción del problema', 'Solución propuesta', 'Contexto del sistema'],
          priority: 'high'
        })
        break
        
      case 'configurationWarnings':
        questions.push({
          question: "¿Qué advertencias de configuración son incorrectas o innecesarias?",
          category: 'specification',
          targetSection: section,
          examples: ['Advertencias obsoletas', 'Configuración incorrecta', 'Faltan advertencias importantes'],
          priority: 'medium'
        })
        break
    }
    
    return questions
  }

  /**
   * Generate context explanation
   */
  private generateContextExplanation(
    userMessage: string,
    targetSections: CanvasSection[],
    questionType: 'vague_complaint' | 'missing_context' | 'scope_clarification'
  ): string {
    let context = `Tu mensaje "${userMessage}" `
    
    switch (questionType) {
      case 'vague_complaint':
        context += 'indica que algo está mal, pero necesito más detalles específicos para poder ayudarte efectivamente.'
        break
      case 'scope_clarification':
        context += 'afecta múltiples secciones. Necesito entender el alcance exacto de los cambios.'
        break
      default:
        context += 'requiere más información específica para poder realizar los cambios apropiados.'
    }
    
    if (targetSections.length > 0) {
      const sectionNames = this.getSectionDisplayNames(targetSections)
      context += ` Las secciones identificadas son: ${sectionNames.join(', ')}.`
    }
    
    return context
  }

  /**
   * Generate suggested actions
   */
  private generateSuggestedActions(
    targetSections: CanvasSection[],
    currentCanvas: QACanvasDocument
  ): string[] {
    const actions: string[] = []
    
    if (targetSections.includes('acceptanceCriteria')) {
      actions.push('Revisar cada criterio de aceptación individualmente')
      if (currentCanvas.testCases.length > 0) {
        actions.push('Considerar el impacto en los casos de prueba existentes')
      }
    }
    
    if (targetSections.includes('testCases')) {
      actions.push('Especificar qué casos de prueba necesitan cambios')
      actions.push('Indicar si prefieres un formato específico (Gherkin, pasos, tabla)')
    }
    
    if (targetSections.includes('ticketSummary')) {
      actions.push('Identificar qué información falta o es incorrecta en el resumen')
    }
    
    // Generic actions
    actions.push('Proporcionar ejemplos específicos de lo que esperas ver')
    actions.push('Indicar la prioridad de cada cambio solicitado')
    
    return actions.slice(0, 4) // Limit to 4 actions
  }

  /**
   * Get section display names in Spanish
   */
  private getSectionDisplayNames(sections: CanvasSection[]): string[] {
    const displayNames = {
      ticketSummary: 'Resumen del ticket',
      acceptanceCriteria: 'Criterios de aceptación',
      testCases: 'Casos de prueba',
      configurationWarnings: 'Advertencias de configuración',
      metadata: 'Metadatos'
    }
    
    return sections.map(section => displayNames[section])
  }

  /**
   * Assess canvas complexity
   */
  private assessCanvasComplexity(currentCanvas: QACanvasDocument): string {
    const totalItems = currentCanvas.acceptanceCriteria.length + 
                      currentCanvas.testCases.length +
                      currentCanvas.configurationWarnings.length

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
   * Validate clarification questions for quality
   */
  validateQuestions(questions: ClarificationQuestion[]): {
    isValid: boolean
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    
    // Check for too many questions
    if (questions.length > 5) {
      issues.push('Demasiadas preguntas pueden abrumar al usuario')
      suggestions.push('Limitar a máximo 4 preguntas prioritarias')
    }
    
    // Check for too few questions
    if (questions.length === 0) {
      issues.push('No se generaron preguntas de clarificación')
      suggestions.push('Generar al menos 1-2 preguntas específicas')
    }
    
    // Check for vague questions
    const vagueQuestions = questions.filter(q => 
      q.question.includes('¿Qué quieres?') || 
      q.question.includes('¿Cómo?') ||
      q.question.length < 20
    )
    
    if (vagueQuestions.length > 0) {
      issues.push('Algunas preguntas son demasiado vagas')
      suggestions.push('Hacer preguntas más específicas y contextualizadas')
    }
    
    // Check for missing examples
    const questionsWithoutExamples = questions.filter(q => 
      !q.examples || q.examples.length === 0
    )
    
    if (questionsWithoutExamples.length > questions.length / 2) {
      suggestions.push('Agregar ejemplos de respuesta para guiar al usuario')
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * Prioritize questions based on context and importance
   */
  prioritizeQuestions(questions: ClarificationQuestion[]): ClarificationQuestion[] {
    return questions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const categoryOrder = { 
        specification: 5, 
        scope: 4, 
        dependency: 3, 
        priority: 2, 
        format: 1 
      }
      
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      // Then by category importance
      return categoryOrder[b.category] - categoryOrder[a.category]
    })
  }
}