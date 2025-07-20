/**
 * IntentAnalyzer - AI-powered component for analyzing user intent in QA conversations
 * Uses pure AI classification without hardcoded keywords for language-agnostic intent detection
 */

import { tool } from 'ai'
import { generateTextWithFailover } from '../providerFailover'
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
  intentTypeSchema,
  canvasSectionSchema,
  intentAnalysisResultSchema
} from './types'

/**
 * AI tool for pure intent classification - no hardcoded keywords needed
 */
const intentClassificationTool = tool({
  description: "Classify user intent for QA canvas interactions using AI analysis only",
  parameters: z.object({
    intent: intentTypeSchema.describe("Primary intent classification based on user message context"),
    confidence: z.number().min(0).max(1).describe("AI confidence score for this classification"),
    targetSections: z.array(canvasSectionSchema).describe("Canvas sections the user wants to modify or reference"),
    reasoning: z.string().describe("Clear explanation of why this intent was chosen"),
    detectedLanguage: z.string().describe("Language detected in user message (e.g., 'spanish', 'english', 'mixed')"),
    shouldModifyCanvas: z.boolean().describe("Whether this intent requires canvas modification"),
    requiresClarification: z.boolean().describe("Whether the message is too vague and needs clarification"),
    urgencyLevel: z.enum(['low', 'medium', 'high']).describe("Perceived urgency of the user request"),
    contextualHints: z.array(z.string()).describe("Key phrases or context clues that influenced the decision")
  })
})

/**
 * IntentAnalyzer class for analyzing user messages and determining intent
 */
export class IntentAnalyzer {
  // No need for model instance - using failover system

  /**
   * Analyze user intent using pure AI classification - no hardcoded keywords
   */
  async analyzeIntent(
    userMessage: string,
    conversationHistory: UIMessage[],
    currentCanvas?: QACanvasDocument
  ): Promise<IntentAnalysisResult> {
    try {
      console.log('🤖 Starting AI-powered intent analysis...')
      
      // Build analysis context
      const context = this.buildAnalysisContext(conversationHistory, currentCanvas)

      // Use AI for complete intent classification
      const aiResult = await this.performPureAIAnalysis(
        userMessage,
        conversationHistory,
        currentCanvas,
        context
      )

      // Build final result with context
      const finalResult: IntentAnalysisResult = {
        intent: aiResult.intent,
        confidence: aiResult.confidence,
        targetSections: aiResult.targetSections,
        context,
        reasoning: aiResult.reasoning,
        keywords: aiResult.contextualHints || [], // Use AI-detected hints instead of hardcoded keywords
        shouldModifyCanvas: aiResult.shouldModifyCanvas,
        requiresClarification: aiResult.requiresClarification
      }

      // Validate result
      const validationResult = intentAnalysisResultSchema.safeParse(finalResult)
      if (!validationResult.success) {
        console.warn('Intent analysis validation failed, using fallback:', validationResult.error.message)
        return this.createFallbackResult(userMessage, new Error('Validation failed'))
      }

      console.log(`✅ Intent classified: ${finalResult.intent} (confidence: ${finalResult.confidence})`)
      return finalResult

    } catch (error) {
      console.error('❌ Intent analysis failed:', error)
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
   * Perform pure AI-based intent analysis without hardcoded keywords
   */
  private async performPureAIAnalysis(
    userMessage: string,
    conversationHistory: UIMessage[],
    currentCanvas?: QACanvasDocument,
    context?: AnalysisContext
  ): Promise<{
    intent: IntentType
    confidence: number
    targetSections: CanvasSection[]
    reasoning: string
    contextualHints: string[]
    shouldModifyCanvas: boolean
    requiresClarification: boolean
    detectedLanguage: string
    urgencyLevel: 'low' | 'medium' | 'high'
  }> {
    const systemPrompt = this.buildAISystemPrompt(currentCanvas, context)
    const conversationContext = this.buildConversationContext(conversationHistory)

    try {
      console.log('🧠 Sending message to AI for intent classification...')
      
      const result = await generateTextWithFailover(
        `
Analyze this user message and classify their intent with high confidence:

USER MESSAGE: "${userMessage}"

CONVERSATION CONTEXT:
${conversationContext}

${currentCanvas ? `
CURRENT CANVAS STATE:
- Acceptance Criteria: ${currentCanvas.acceptanceCriteria.length} items
- Test Cases: ${currentCanvas.testCases.length} items  
- Configuration Warnings: ${currentCanvas.configurationWarnings.length} items
- Ticket Summary: ${currentCanvas.ticketSummary.problem ? 'Present' : 'Missing'}
- Ticket ID: ${currentCanvas.metadata.ticketId}
` : 'No canvas currently available.'}

Classify the intent and provide detailed analysis. Be decisive and confident in your classification.
        `,
        {
          system: systemPrompt,
          tools: { intentClassification: intentClassificationTool },
          toolChoice: 'required',
          maxTokens: 1000,
          temperature: 0.1 // Low temperature for consistent classification
        }
      )

      // Handle both string and object responses from failover system
      if (typeof result === 'string') {
        throw new Error('Intent analysis received text response instead of tool calls')
      }

      const toolCall = result.toolCalls?.[0]
      if (toolCall?.toolName === 'intentClassification') {
        const args = toolCall.args
        console.log(`🎯 AI classified intent: ${args.intent} (${args.confidence}) - ${args.reasoning}`)
        return args as any
      }

      throw new Error('AI did not return expected intent classification')

    } catch (error) {
      console.error('❌ AI analysis failed:', error)
      throw error
    }
  }



  /**
   * Build AI system prompt for pure intent classification
   */
  private buildAISystemPrompt(
    currentCanvas?: QACanvasDocument,
    context?: AnalysisContext
  ): string {
    return `
You are an expert intent classifier for a QA system that helps analyze Jira tickets and generate test documentation.

Your job is to classify user intent DECISIVELY and PRACTICALLY using only AI analysis - no hardcoded keywords needed.

INTENT CATEGORIES:

1. **modify_canvas**: User wants to modify canvas content (criteria, test cases, etc.)
   - This is the MOST COMMON intent - when in doubt, choose this
   - Examples: complaints, corrections, improvements, additions, changes
   - Any indication something is wrong, missing, or needs improvement

2. **ask_clarification**: ONLY when user message is extremely vague and incomprehensible
   - Use this category VERY RARELY (less than 5% of cases)
   - Only for completely unclear single-word messages without context

3. **provide_information**: User wants information without modifying the document
   - Questions about existing content: "what does this mean?", "explain this"
   - Requests for explanations of current state

4. **request_explanation**: User wants detailed explanation of existing content
   - Similar to provide_information but more specific about explanations
   - "explain why", "help me understand", "how does this work"

5. **off_topic**: User asks about non-QA/testing topics
   - Sports, weather, food, entertainment, personal topics, etc.

CRITICAL RULES:
- BE DECISIVE: Any indication of wanting changes → modify_canvas
- DON'T ASK FOR CLARIFICATION unless message is completely incomprehensible
- If they mention any section (criteria, test cases, etc.) → modify_canvas  
- If they say something is wrong, incorrect, has errors → modify_canvas
- If no specific section mentioned but want changes → assume acceptanceCriteria (most common)
- High confidence (0.7+) for clear decisions
- requiresClarification = false in 95% of cases
- Work in ANY LANGUAGE - Spanish, English, mixed, or others

LANGUAGE DETECTION:
- Detect the primary language of the user message
- Provide appropriate responses regardless of language
- Handle mixed-language messages appropriately

DECISION EXAMPLES (any language):
- "Los criterios están mal" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.8
- "This is wrong" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.8  
- "Falta información" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.7
- "Missing info" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.7
- "Needs improvement" → modify_canvas, targetSections: ['acceptanceCriteria'], confidence: 0.7
- "¿Qué significa esto?" → provide_information, confidence: 0.8
- "What does this mean?" → provide_information, confidence: 0.8

CONTEXT AWARENESS:
${context ? `
- Has Canvas: ${context.hasCanvas}
- Canvas Complexity: ${context.canvasComplexity}
- Conversation Length: ${context.conversationLength}
- Available Sections: ${context.availableSections.join(', ')}
` : 'No context available'}

Be confident, decisive, and language-agnostic in your classifications.
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
   * Extract last user intent from conversation history using AI context
   */
  private extractLastUserIntent(conversationHistory: UIMessage[]): IntentType | undefined {
    const lastUserMessage = conversationHistory
      .filter(msg => msg.role === 'user')
      .pop()

    if (!lastUserMessage) return undefined

    // In pure AI approach, we don't try to guess from keywords
    // We let the AI handle all context analysis
    return undefined
  }

  /**
   * Create fallback result when AI analysis fails
   */
  private createFallbackResult(userMessage: string, error: Error): IntentAnalysisResult {
    console.warn('🚨 Using fallback intent analysis due to AI error:', error.message)

    // Smart fallback: assume modification intent (most common case)
    // This is safer than asking for clarification when AI fails
    return {
      intent: 'modify_canvas', // Always default to modification - safest assumption
      confidence: 0.5, // Lower confidence since this is fallback
      targetSections: ['acceptanceCriteria'], // Default to most common section
      context: {
        hasCanvas: false,
        canvasComplexity: 'simple',
        conversationLength: 0,
        availableSections: []
      },
      reasoning: `AI intent analysis failed (${error.message}). Using fallback assumption: user wants to modify canvas content.`,
      keywords: [], // No keywords in pure AI approach
      shouldModifyCanvas: true,
      requiresClarification: false // Don't require clarification even in fallback - be decisive
    }
  }


}