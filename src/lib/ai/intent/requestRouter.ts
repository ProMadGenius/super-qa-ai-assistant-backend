/**
 * Request Router and Response Generation System
 * Handles routing of requests based on intent analysis and generates appropriate responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import {
  IntentAnalysisMiddleware,
  RequestPreprocessor,
  ResponseFormatter,
  type RequestContext,
  type MiddlewareResponse,
  type MiddlewareResponseType,
  DEFAULT_MIDDLEWARE_CONFIG
} from './middleware'
import type { IntentType, CanvasSection } from './types'
import { handleAIError } from '../errorHandler'

/**
 * Request routing configuration
 */
export interface RouterConfig {
  enableStreaming: boolean
  enableFallback: boolean
  timeoutMs: number
  maxRetries: number
  enableMetrics: boolean
}

/**
 * Default router configuration
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  enableStreaming: true,
  enableFallback: true,
  timeoutMs: 30000, // 30 seconds
  maxRetries: 2,
  enableMetrics: true
}

/**
 * Request routing metrics
 */
export interface RoutingMetrics {
  requestId: string
  timestamp: string
  processingTime: number
  intent: IntentType
  confidence: number
  responseType: MiddlewareResponseType
  success: boolean
  errorCode?: string
  retryCount: number
}

/**
 * Streaming response chunk for clarification and information responses
 */
export interface StreamingChunk {
  type: 'chunk' | 'complete' | 'error'
  data: any
  timestamp: string
}

/**
 * Unified response format that maintains compatibility with existing clients
 */
export interface UnifiedResponse {
  // Core response data
  type: 'modification' | 'clarification' | 'information' | 'rejection' | 'fallback'
  
  // Intent analysis metadata
  intent?: IntentType
  confidence?: number
  targetSections?: CanvasSection[]
  sessionId?: string
  
  // Response-specific data
  updatedDocument?: any // For modification responses
  questions?: any[] // For clarification responses
  response?: string // For information responses
  changesSummary?: string // For all response types
  
  // Additional metadata
  relevantSections?: CanvasSection[]
  citations?: any[]
  suggestedFollowUps?: string[]
  suggestedActions?: string[]
  dependencyAnalysis?: any
  
  // Processing metadata
  processingTime?: number
  requestId?: string
  timestamp?: string
  
  // Error handling
  error?: string
  fallbackReason?: string
  proceedWithModification?: boolean
  proceedWithOriginalLogic?: boolean
}

/**
 * Main request router class
 */
export class RequestRouter {
  private middleware: IntentAnalysisMiddleware
  private config: RouterConfig
  private metrics: RoutingMetrics[] = []

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config }
    this.middleware = new IntentAnalysisMiddleware({
      enableIntentAnalysis: true,
      enableDependencyAnalysis: true,
      enableConversationState: true,
      fallbackToOriginal: this.config.enableFallback,
      timeoutMs: this.config.timeoutMs
    })
  }

  /**
   * Route request through intent analysis pipeline
   */
  async routeRequest(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now()
    const requestId = uuidv4()
    let retryCount = 0

    try {
      // Extract request context
      const context = await RequestPreprocessor.extractRequestContext(request)
      
      // Process request with retries
      let middlewareResponse: MiddlewareResponse
      
      while (retryCount <= this.config.maxRetries) {
        try {
          middlewareResponse = await this.middleware.processRequest(context)
          break
        } catch (error) {
          retryCount++
          if (retryCount > this.config.maxRetries) {
            throw error
          }
          console.warn(`Request processing failed, retry ${retryCount}/${this.config.maxRetries}:`, error)
          await this.delay(1000 * retryCount) // Exponential backoff
        }
      }

      // Generate response based on middleware result
      const response = await this.generateResponse(middlewareResponse!, context, requestId)

      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetrics({
          requestId,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          intent: middlewareResponse!.intent,
          confidence: middlewareResponse!.confidence,
          responseType: middlewareResponse!.type,
          success: true,
          retryCount
        })
      }

      return response

    } catch (error) {
      console.error('Request routing failed:', error)

      // Record error metrics
      if (this.config.enableMetrics) {
        this.recordMetrics({
          requestId,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          intent: 'modify_canvas', // Default fallback
          confidence: 0,
          responseType: 'fallback',
          success: false,
          errorCode: error instanceof Error ? error.message : 'Unknown error',
          retryCount
        })
      }

      // Return error response or fallback
      if (this.config.enableFallback) {
        return this.generateFallbackResponse(error, requestId)
      } else {
        return handleAIError(error, requestId)
      }
    }
  }

  /**
   * Generate response based on middleware result
   */
  private async generateResponse(
    middlewareResponse: MiddlewareResponse,
    context: RequestContext,
    requestId: string
  ): Promise<NextResponse> {
    switch (middlewareResponse.type) {
      case 'clarification':
        return this.generateClarificationResponse(middlewareResponse, requestId)

      case 'information':
        return this.generateInformationResponse(middlewareResponse, requestId)

      case 'rejection':
        return this.generateRejectionResponse(middlewareResponse, requestId)

      case 'modification':
        return this.generateModificationResponse(middlewareResponse, context, requestId)

      case 'fallback':
        return this.generateFallbackResponse(
          new Error(middlewareResponse.data.fallbackReason || 'Intent analysis fallback'),
          requestId
        )

      default:
        console.warn(`Unknown middleware response type: ${middlewareResponse.type}`)
        return this.generateFallbackResponse(
          new Error(`Unknown response type: ${middlewareResponse.type}`),
          requestId
        )
    }
  }

  /**
   * Generate clarification response with optional streaming
   */
  private async generateClarificationResponse(
    middlewareResponse: MiddlewareResponse,
    requestId: string
  ): Promise<NextResponse> {
    const clarificationResult = middlewareResponse.data.clarificationResult

    if (!clarificationResult) {
      return this.generateFallbackResponse(
        new Error('Missing clarification data'),
        requestId
      )
    }

    const unifiedResponse: UnifiedResponse = {
      type: 'clarification',
      intent: middlewareResponse.intent,
      confidence: middlewareResponse.confidence,
      targetSections: middlewareResponse.targetSections,
      sessionId: middlewareResponse.sessionId,
      questions: clarificationResult.questions,
      changesSummary: `I need some clarification to better understand your request. ${clarificationResult.context}`,
      suggestedActions: clarificationResult.suggestedActions,
      processingTime: middlewareResponse.metadata.processingTime,
      requestId,
      timestamp: middlewareResponse.metadata.timestamp
    }

    // Enable streaming for clarification responses if configured
    if (this.config.enableStreaming) {
      return this.generateStreamingResponse(unifiedResponse)
    } else {
      return this.generateStandardResponse(unifiedResponse)
    }
  }

  /**
   * Generate information response with optional streaming
   */
  private async generateInformationResponse(
    middlewareResponse: MiddlewareResponse,
    requestId: string
  ): Promise<NextResponse> {
    const contextualResponse = middlewareResponse.data.contextualResponse

    if (!contextualResponse) {
      return this.generateFallbackResponse(
        new Error('Missing contextual response data'),
        requestId
      )
    }

    const unifiedResponse: UnifiedResponse = {
      type: 'information',
      intent: middlewareResponse.intent,
      confidence: middlewareResponse.confidence,
      targetSections: middlewareResponse.targetSections,
      response: contextualResponse.response,
      changesSummary: contextualResponse.response,
      relevantSections: contextualResponse.relevantSections,
      citations: contextualResponse.citations,
      suggestedFollowUps: contextualResponse.suggestedFollowUps,
      processingTime: middlewareResponse.metadata.processingTime,
      requestId,
      timestamp: middlewareResponse.metadata.timestamp
    }

    // Enable streaming for information responses if configured
    if (this.config.enableStreaming) {
      return this.generateStreamingResponse(unifiedResponse)
    } else {
      return this.generateStandardResponse(unifiedResponse)
    }
  }

  /**
   * Generate rejection response
   */
  private async generateRejectionResponse(
    middlewareResponse: MiddlewareResponse,
    requestId: string
  ): Promise<NextResponse> {
    const rejectionMessage = middlewareResponse.data.rejectionMessage || 
      "I'm designed to help with QA documentation and testing-related questions for your Jira tickets."

    const unifiedResponse: UnifiedResponse = {
      type: 'rejection',
      intent: middlewareResponse.intent,
      confidence: middlewareResponse.confidence,
      changesSummary: rejectionMessage,
      processingTime: middlewareResponse.metadata.processingTime,
      requestId,
      timestamp: middlewareResponse.metadata.timestamp
    }

    return this.generateStandardResponse(unifiedResponse)
  }

  /**
   * Generate modification response that indicates canvas should be modified
   */
  private async generateModificationResponse(
    middlewareResponse: MiddlewareResponse,
    context: RequestContext,
    requestId: string
  ): Promise<NextResponse> {
    const dependencyAnalysis = middlewareResponse.data.dependencyAnalysis

    const unifiedResponse: UnifiedResponse = {
      type: 'modification',
      intent: middlewareResponse.intent,
      confidence: middlewareResponse.confidence,
      targetSections: middlewareResponse.targetSections,
      sessionId: middlewareResponse.sessionId,
      dependencyAnalysis,
      proceedWithModification: true,
      changesSummary: `Proceeding with canvas modification for ${middlewareResponse.targetSections.join(', ')}`,
      processingTime: middlewareResponse.metadata.processingTime,
      requestId,
      timestamp: middlewareResponse.metadata.timestamp
    }

    return this.generateStandardResponse(unifiedResponse)
  }

  /**
   * Generate fallback response when intent analysis fails
   */
  private generateFallbackResponse(error: Error, requestId: string): NextResponse {
    const unifiedResponse: UnifiedResponse = {
      type: 'fallback',
      error: 'INTENT_ANALYSIS_ERROR',
      fallbackReason: error.message,
      proceedWithOriginalLogic: true,
      changesSummary: 'Intent analysis unavailable, proceeding with standard processing',
      requestId,
      timestamp: new Date().toISOString()
    }

    return this.generateStandardResponse(unifiedResponse, 500)
  }

  /**
   * Generate streaming response for clarification and information responses
   */
  private generateStreamingResponse(response: UnifiedResponse): NextResponse {
    // Create a readable stream for streaming responses
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      start(controller) {
        // Send initial chunk
        const initialChunk: StreamingChunk = {
          type: 'chunk',
          data: {
            type: response.type,
            intent: response.intent,
            confidence: response.confidence,
            sessionId: response.sessionId
          },
          timestamp: new Date().toISOString()
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialChunk)}\n\n`))

        // Send main content chunk
        const contentChunk: StreamingChunk = {
          type: 'chunk',
          data: {
            questions: response.questions,
            response: response.response,
            citations: response.citations,
            suggestedFollowUps: response.suggestedFollowUps,
            suggestedActions: response.suggestedActions
          },
          timestamp: new Date().toISOString()
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`))

        // Send completion chunk
        const completeChunk: StreamingChunk = {
          type: 'complete',
          data: {
            changesSummary: response.changesSummary,
            processingTime: response.processingTime,
            requestId: response.requestId
          },
          timestamp: new Date().toISOString()
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeChunk)}\n\n`))

        controller.close()
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }

  /**
   * Generate standard JSON response
   */
  private generateStandardResponse(response: UnifiedResponse, status: number = 200): NextResponse {
    return NextResponse.json(response, {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }

  /**
   * Record routing metrics
   */
  private recordMetrics(metrics: RoutingMetrics): void {
    this.metrics.push(metrics)
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Log metrics for monitoring
    console.log(`[RequestRouter] ${metrics.intent} -> ${metrics.responseType} (${metrics.processingTime}ms, confidence: ${metrics.confidence})`)
  }

  /**
   * Get routing metrics
   */
  getMetrics(): RoutingMetrics[] {
    return [...this.metrics]
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalRequests: number
    successRate: number
    averageProcessingTime: number
    intentDistribution: Record<IntentType, number>
    responseTypeDistribution: Record<MiddlewareResponseType, number>
  } {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageProcessingTime: 0,
        intentDistribution: {} as Record<IntentType, number>,
        responseTypeDistribution: {} as Record<MiddlewareResponseType, number>
      }
    }

    const totalRequests = this.metrics.length
    const successfulRequests = this.metrics.filter(m => m.success).length
    const successRate = successfulRequests / totalRequests
    const averageProcessingTime = this.metrics.reduce((sum, m) => sum + m.processingTime, 0) / totalRequests

    const intentDistribution: Record<string, number> = {}
    const responseTypeDistribution: Record<string, number> = {}

    this.metrics.forEach(metric => {
      intentDistribution[metric.intent] = (intentDistribution[metric.intent] || 0) + 1
      responseTypeDistribution[metric.responseType] = (responseTypeDistribution[metric.responseType] || 0) + 1
    })

    return {
      totalRequests,
      successRate,
      averageProcessingTime,
      intentDistribution: intentDistribution as Record<IntentType, number>,
      responseTypeDistribution: responseTypeDistribution as Record<MiddlewareResponseType, number>
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Default router instance
 */
export const requestRouter = new RequestRouter()

/**
 * Enhanced route handler that can be used in API routes
 */
export async function handleIntentAwareRequest(request: NextRequest): Promise<NextResponse> {
  return await requestRouter.routeRequest(request)
}

/**
 * Route handler factory for creating custom routers
 */
export function createRouteHandler(config: Partial<RouterConfig> = {}) {
  const router = new RequestRouter(config)
  return async (request: NextRequest): Promise<NextResponse> => {
    return await router.routeRequest(request)
  }
}

/**
 * Middleware integration helper for existing API routes
 */
export async function enhanceExistingRoute(
  request: NextRequest,
  originalHandler: (request: NextRequest) => Promise<NextResponse>,
  config: Partial<RouterConfig> = {}
): Promise<NextResponse> {
  const router = new RequestRouter(config)
  
  try {
    // Try intent-aware routing first
    const context = await RequestPreprocessor.extractRequestContext(request)
    const middlewareResponse = await router['middleware'].processRequest(context)
    
    // If intent analysis suggests proceeding with original logic, do so
    if (middlewareResponse.type === 'modification' || middlewareResponse.type === 'fallback') {
      return await originalHandler(request)
    }
    
    // Otherwise, use intent-aware response
    return await router.generateResponse(middlewareResponse, context, uuidv4())
  } catch (error) {
    console.warn('Intent analysis failed, falling back to original handler:', error)
    return await originalHandler(request)
  }
}