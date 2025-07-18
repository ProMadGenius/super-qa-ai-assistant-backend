/**
 * Intent Analysis Middleware
 * Processes incoming requests through intent analysis pipeline and routes responses appropriately
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import {
  IntentAnalyzer,
  SectionTargetDetector,
  DependencyAnalyzer,
  ClarificationGenerator,
  ContextualResponseGenerator,
  conversationStateManager,
  generateSessionId,
  type IntentAnalysisResult,
  type IntentType,
  type CanvasSection,
  type ClarificationResult,
  type ContextualResponse,
  type ConversationState,
  REJECTION_TEMPLATES,
  RESPONSE_LIMITS
} from './index'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import type { JiraTicket } from '../../schemas/JiraTicket'
import { handleAIError, handleValidationError } from '../errorHandler'

/**
 * Standard message format for middleware processing
 */
export interface MiddlewareMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string | Date
}

/**
 * Request context extracted from incoming requests
 */
export interface RequestContext {
  messages: MiddlewareMessage[]
  currentDocument?: QACanvasDocument
  originalTicketData?: JiraTicket
  sessionId?: string
  userPreferences?: {
    testCaseFormat?: string
    focusAreas?: string[]
  }
}

/**
 * Intent analysis middleware configuration
 */
export interface MiddlewareConfig {
  enableIntentAnalysis: boolean
  enableDependencyAnalysis: boolean
  enableConversationState: boolean
  fallbackToOriginal: boolean
  timeoutMs: number
}

/**
 * Default middleware configuration
 */
export const DEFAULT_MIDDLEWARE_CONFIG: MiddlewareConfig = {
  enableIntentAnalysis: true,
  enableDependencyAnalysis: true,
  enableConversationState: true,
  fallbackToOriginal: true,
  timeoutMs: 5000 // Reduced to 5 seconds for faster responses
}

/**
 * Middleware response types
 */
export type MiddlewareResponseType = 
  | 'modification'     // Canvas should be modified
  | 'clarification'    // Need clarification from user
  | 'information'      // Provide information without modification
  | 'rejection'        // Politely reject off-topic request
  | 'fallback'         // Fall back to original logic

/**
 * Structured middleware response
 */
export interface MiddlewareResponse {
  type: MiddlewareResponseType
  intent: IntentType
  confidence: number
  targetSections: CanvasSection[]
  sessionId: string
  data: {
    clarificationResult?: ClarificationResult
    contextualResponse?: ContextualResponse
    dependencyAnalysis?: any
    rejectionMessage?: string
    fallbackReason?: string
  }
  metadata: {
    processingTime: number
    requestId: string
    timestamp: string
  }
}

/**
 * Intent analysis error with fallback information
 */
export class IntentAnalysisMiddlewareError extends Error {
  code: 'MIDDLEWARE_ERROR' | 'INTENT_ANALYSIS_FAILED' | 'TIMEOUT' | 'INVALID_REQUEST'
  fallbackAction: MiddlewareResponseType
  context: RequestContext
  requestId: string

  constructor(
    message: string,
    code: IntentAnalysisMiddlewareError['code'],
    fallbackAction: MiddlewareResponseType,
    context: RequestContext,
    requestId: string
  ) {
    super(message)
    this.name = 'IntentAnalysisMiddlewareError'
    this.code = code
    this.fallbackAction = fallbackAction
    this.context = context
    this.requestId = requestId
  }
}

/**
 * Main intent analysis middleware class
 */
export class IntentAnalysisMiddleware {
  private intentAnalyzer: IntentAnalyzer
  private sectionTargetDetector: SectionTargetDetector
  private dependencyAnalyzer: DependencyAnalyzer
  private clarificationGenerator: ClarificationGenerator
  private contextualResponseGenerator: ContextualResponseGenerator
  private config: MiddlewareConfig

  constructor(config: Partial<MiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_MIDDLEWARE_CONFIG, ...config }
    this.intentAnalyzer = new IntentAnalyzer()
    this.sectionTargetDetector = new SectionTargetDetector()
    this.dependencyAnalyzer = new DependencyAnalyzer()
    this.clarificationGenerator = new ClarificationGenerator()
    this.contextualResponseGenerator = new ContextualResponseGenerator()
  }

  /**
   * Process request through intent analysis pipeline
   */
  async processRequest(context: RequestContext): Promise<MiddlewareResponse> {
    const startTime = Date.now()
    const requestId = uuidv4()
    const sessionId = context.sessionId || generateSessionId()

    try {
      // Extract latest user message
      const latestUserMessage = this.extractLatestUserMessage(context.messages)
      if (!latestUserMessage) {
        throw this.createMiddlewareError(
          'INVALID_REQUEST',
          'No user message found in request',
          'fallback',
          context,
          requestId
        )
      }

      // Perform intent analysis with timeout
      const intentResult = await this.performIntentAnalysis(
        latestUserMessage.content,
        context.messages,
        context.currentDocument
      )

      // Route based on intent type
      const response = await this.routeByIntent(
        intentResult,
        latestUserMessage.content,
        context,
        sessionId,
        requestId
      )

      // Calculate processing time
      const processingTime = Date.now() - startTime

      return {
        ...response,
        metadata: {
          ...response.metadata,
          processingTime,
          requestId,
          timestamp: new Date().toISOString()
        }
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      
      if (error instanceof IntentAnalysisMiddlewareError) {
        // Return structured error response with fallback
        return {
          type: error.fallbackAction,
          intent: 'modify_canvas', // Default fallback intent
          confidence: 0,
          targetSections: [],
          sessionId,
          data: {
            fallbackReason: error.message
          },
          metadata: {
            processingTime,
            requestId,
            timestamp: new Date().toISOString()
          }
        }
      }

      // Handle unexpected errors
      console.error('Unexpected middleware error:', error)
      return {
        type: 'fallback',
        intent: 'modify_canvas',
        confidence: 0,
        targetSections: [],
        sessionId,
        data: {
          fallbackReason: 'Unexpected error in intent analysis middleware'
        },
        metadata: {
          processingTime,
          requestId,
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  /**
   * Perform intent analysis with timeout and error handling
   */
  private async performIntentAnalysis(
    userMessage: string,
    messages: MiddlewareMessage[],
    currentDocument?: QACanvasDocument
  ): Promise<IntentAnalysisResult> {
    if (!this.config.enableIntentAnalysis) {
      // Return default intent if analysis is disabled
      return {
        intent: 'modify_canvas',
        confidence: 0.5,
        targetSections: [],
        context: {
          hasCanvas: !!currentDocument,
          canvasComplexity: 'medium',
          conversationLength: messages.length,
          availableSections: []
        },
        reasoning: 'Intent analysis disabled',
        keywords: [],
        shouldModifyCanvas: true,
        requiresClarification: false
      }
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Intent analysis timeout'))
      }, this.config.timeoutMs)
    })

    // Race between intent analysis and timeout
    try {
      return await Promise.race([
        this.intentAnalyzer.analyzeIntent(userMessage, messages, currentDocument),
        timeoutPromise
      ])
    } catch (error) {
      if (error instanceof Error && error.message === 'Intent analysis timeout') {
        console.warn('Intent analysis timed out, using fallback')
        return {
          intent: 'modify_canvas', // Default to modification instead of clarification
          confidence: 0.6,
          targetSections: ['acceptanceCriteria'], // Default to most common section
          context: {
            hasCanvas: !!currentDocument,
            canvasComplexity: 'medium',
            conversationLength: messages.length,
            availableSections: []
          },
          reasoning: 'Analysis timed out, defaulting to canvas modification',
          keywords: [],
          shouldModifyCanvas: true,
          requiresClarification: false // Don't require clarification on timeout
        }
      }
      throw error
    }
  }

  /**
   * Route request based on intent analysis result
   */
  private async routeByIntent(
    intentResult: IntentAnalysisResult,
    userMessage: string,
    context: RequestContext,
    sessionId: string,
    requestId: string
  ): Promise<MiddlewareResponse> {
    switch (intentResult.intent) {
      case 'ask_clarification':
        return await this.handleClarificationIntent(
          intentResult,
          userMessage,
          context,
          sessionId,
          requestId
        )

      case 'provide_information':
      case 'request_explanation':
        return await this.handleInformationIntent(
          intentResult,
          userMessage,
          context,
          requestId
        )

      case 'off_topic':
        return await this.handleOffTopicIntent(
          intentResult,
          sessionId,
          requestId
        )

      case 'modify_canvas':
        return await this.handleModificationIntent(
          intentResult,
          userMessage,
          context,
          sessionId,
          requestId
        )

      default:
        console.warn(`Unknown intent type: ${intentResult.intent}`)
        return {
          type: 'fallback',
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          targetSections: intentResult.targetSections,
          sessionId,
          data: {
            fallbackReason: `Unknown intent type: ${intentResult.intent}`
          },
          metadata: {
            processingTime: 0,
            requestId,
            timestamp: new Date().toISOString()
          }
        }
    }
  }

  /**
   * Handle clarification intent
   */
  private async handleClarificationIntent(
    intentResult: IntentAnalysisResult,
    userMessage: string,
    context: RequestContext,
    sessionId: string,
    requestId: string
  ): Promise<MiddlewareResponse> {
    try {
      const clarificationResult = await this.clarificationGenerator.generateClarificationQuestions(
        userMessage,
        intentResult.targetSections,
        context.currentDocument
      )

      // Update conversation state if enabled
      if (this.config.enableConversationState) {
        await conversationStateManager.updateState(sessionId, {
          currentPhase: 'awaiting_clarification',
          pendingClarifications: clarificationResult.questions,
          lastIntent: intentResult,
          awaitingResponse: true
        })
      }

      return {
        type: 'clarification',
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        targetSections: intentResult.targetSections,
        sessionId,
        data: {
          clarificationResult
        },
        metadata: {
          processingTime: 0,
          requestId,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Clarification generation failed:', error)
      throw this.createMiddlewareError(
        'INTENT_ANALYSIS_FAILED',
        'Failed to generate clarification questions',
        'fallback',
        context,
        requestId
      )
    }
  }

  /**
   * Handle information intent
   */
  private async handleInformationIntent(
    intentResult: IntentAnalysisResult,
    userMessage: string,
    context: RequestContext,
    requestId: string
  ): Promise<MiddlewareResponse> {
    try {
      const contextualResponse = await this.contextualResponseGenerator.generateContextualResponse(
        userMessage,
        context.currentDocument,
        context.originalTicketData
      )

      return {
        type: 'information',
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        targetSections: intentResult.targetSections,
        sessionId: generateSessionId(),
        data: {
          contextualResponse
        },
        metadata: {
          processingTime: 0,
          requestId,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Contextual response generation failed:', error)
      throw this.createMiddlewareError(
        'INTENT_ANALYSIS_FAILED',
        'Failed to generate contextual response',
        'fallback',
        context,
        requestId
      )
    }
  }

  /**
   * Handle off-topic intent
   */
  private async handleOffTopicIntent(
    intentResult: IntentAnalysisResult,
    sessionId: string,
    requestId: string
  ): Promise<MiddlewareResponse> {
    // Select appropriate rejection message in Spanish
    const rejectionMessage = REJECTION_TEMPLATES.es[0]

    return {
      type: 'rejection',
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      targetSections: intentResult.targetSections,
      sessionId,
      data: {
        rejectionMessage
      },
      metadata: {
        processingTime: 0,
        requestId,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Handle modification intent with dependency analysis
   */
  private async handleModificationIntent(
    intentResult: IntentAnalysisResult,
    userMessage: string,
    context: RequestContext,
    sessionId: string,
    requestId: string
  ): Promise<MiddlewareResponse> {
    let dependencyAnalysis = null

    // Perform dependency analysis if enabled
    if (this.config.enableDependencyAnalysis && context.currentDocument) {
      try {
        dependencyAnalysis = await this.dependencyAnalyzer.analyzeDependencies(
          intentResult.targetSections,
          context.currentDocument,
          userMessage
        )
      } catch (error) {
        console.warn('Dependency analysis failed:', error)
        // Continue without dependency analysis
      }
    }

    return {
      type: 'modification',
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      targetSections: intentResult.targetSections,
      sessionId,
      data: {
        dependencyAnalysis
      },
      metadata: {
        processingTime: 0,
        requestId,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Extract latest user message from conversation
   */
  private extractLatestUserMessage(messages: MiddlewareMessage[]): MiddlewareMessage | null {
    const userMessages = messages.filter(msg => msg.role === 'user')
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null
  }

  /**
   * Create structured middleware error
   */
  private createMiddlewareError(
    code: IntentAnalysisMiddlewareError['code'],
    message: string,
    fallbackAction: MiddlewareResponseType,
    context: RequestContext,
    requestId: string
  ): IntentAnalysisMiddlewareError {
    return new IntentAnalysisMiddlewareError(message, code, fallbackAction, context, requestId)
  }
}

/**
 * Default middleware instance
 */
export const intentAnalysisMiddleware = new IntentAnalysisMiddleware()

/**
 * Middleware request preprocessing utilities
 */
export class RequestPreprocessor {
  /**
   * Extract request context from Next.js request
   */
  static async extractRequestContext(request: NextRequest): Promise<RequestContext> {
    try {
      const body = await request.json()
      
      return {
        messages: this.normalizeMessages(body.messages || []),
        currentDocument: body.currentDocument,
        originalTicketData: body.originalTicketData,
        sessionId: body.sessionId,
        userPreferences: this.extractUserPreferences(body)
      }
    } catch (error) {
      throw new Error(`Failed to extract request context: ${error}`)
    }
  }

  /**
   * Normalize messages to standard format
   */
  private static normalizeMessages(messages: any[]): MiddlewareMessage[] {
    return messages.map(msg => ({
      id: msg.id || uuidv4(),
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt
    }))
  }

  /**
   * Extract user preferences from request body
   */
  private static extractUserPreferences(body: any): RequestContext['userPreferences'] {
    const preferences: RequestContext['userPreferences'] = {}

    if (body.currentDocument?.metadata?.qaProfile) {
      const qaProfile = body.currentDocument.metadata.qaProfile
      preferences.testCaseFormat = qaProfile.testCaseFormat
      
      if (qaProfile.qaCategories) {
        preferences.focusAreas = Object.entries(qaProfile.qaCategories)
          .filter(([_, active]) => active)
          .map(([category]) => category)
      }
    }

    return preferences
  }
}

/**
 * Response formatting utilities
 */
export class ResponseFormatter {
  /**
   * Format middleware response for Next.js response
   */
  static formatResponse(middlewareResponse: MiddlewareResponse): NextResponse {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    switch (middlewareResponse.type) {
      case 'clarification':
        return NextResponse.json({
          type: 'clarification',
          questions: middlewareResponse.data.clarificationResult?.questions || [],
          context: middlewareResponse.data.clarificationResult?.context || '',
          suggestedActions: middlewareResponse.data.clarificationResult?.suggestedActions || [],
          sessionId: middlewareResponse.sessionId,
          changesSummary: `Necesito algunas aclaraciones para entender mejor tu solicitud. ${middlewareResponse.data.clarificationResult?.context || ''}`
        }, { headers })

      case 'information':
        return NextResponse.json({
          type: 'information',
          response: middlewareResponse.data.contextualResponse?.response || '',
          relevantSections: middlewareResponse.data.contextualResponse?.relevantSections || [],
          citations: middlewareResponse.data.contextualResponse?.citations || [],
          suggestedFollowUps: middlewareResponse.data.contextualResponse?.suggestedFollowUps || [],
          changesSummary: middlewareResponse.data.contextualResponse?.response || ''
        }, { headers })

      case 'rejection':
        return NextResponse.json({
          type: 'rejection',
          changesSummary: middlewareResponse.data.rejectionMessage || 'Solo puedo ayudar con temas relacionados con QA y testing.'
        }, { headers })

      case 'modification':
        // Return indication that modification should proceed
        return NextResponse.json({
          type: 'modification',
          intent: middlewareResponse.intent,
          confidence: middlewareResponse.confidence,
          targetSections: middlewareResponse.targetSections,
          dependencyAnalysis: middlewareResponse.data.dependencyAnalysis,
          sessionId: middlewareResponse.sessionId,
          proceedWithModification: true
        }, { headers })

      case 'fallback':
        return NextResponse.json({
          type: 'fallback',
          reason: middlewareResponse.data.fallbackReason || 'Intent analysis unavailable',
          proceedWithOriginalLogic: true
        }, { headers })

      default:
        return NextResponse.json({
          type: 'error',
          message: 'Unknown response type'
        }, { status: 500, headers })
    }
  }

  /**
   * Format error response
   */
  static formatErrorResponse(error: IntentAnalysisMiddlewareError): NextResponse {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    return NextResponse.json({
      error: 'INTENT_ANALYSIS_ERROR',
      code: error.code,
      message: error.message,
      fallbackAction: error.fallbackAction,
      requestId: error.requestId,
      timestamp: new Date().toISOString()
    }, { status: 500, headers })
  }
}