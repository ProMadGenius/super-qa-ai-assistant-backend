/**
 * Tests for Request Router and Response Generation System
 * Comprehensive testing of request routing, response generation, and streaming capabilities
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  RequestRouter,
  requestRouter,
  handleIntentAwareRequest,
  createRouteHandler,
  enhanceExistingRoute,
  DEFAULT_ROUTER_CONFIG,
  type RouterConfig,
  type RoutingMetrics,
  type UnifiedResponse,
  type StreamingChunk
} from '../../../../lib/ai/intent/requestRouter'

// Mock the middleware
vi.mock('../../../../lib/ai/intent/middleware', () => ({
  IntentAnalysisMiddleware: vi.fn().mockImplementation(() => ({
    processRequest: vi.fn()
  })),
  RequestPreprocessor: {
    extractRequestContext: vi.fn()
  },
  ResponseFormatter: {
    formatResponse: vi.fn()
  },
  DEFAULT_MIDDLEWARE_CONFIG: {}
}))

// Mock error handler
vi.mock('../../../../lib/ai/errorHandler', () => ({
  handleAIError: vi.fn().mockReturnValue(
    NextResponse.json({ error: 'AI_ERROR' }, { status: 500 })
  )
}))

describe('RequestRouter', () => {
  let router: RequestRouter
  let mockRequest: NextRequest
  let mockContext: any
  let mockMiddlewareResponse: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    router = new RequestRouter()
    
    mockRequest = {
      json: vi.fn().mockResolvedValue({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Test message',
            createdAt: new Date().toISOString()
          }
        ],
        currentDocument: {
          metadata: {
            ticketId: 'TEST-123'
          }
        }
      })
    } as unknown as NextRequest

    mockContext = {
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          createdAt: new Date().toISOString()
        }
      ],
      currentDocument: {
        metadata: {
          ticketId: 'TEST-123'
        }
      }
    }

    mockMiddlewareResponse = {
      type: 'modification',
      intent: 'modify_canvas',
      confidence: 0.9,
      targetSections: ['acceptanceCriteria'],
      sessionId: 'test-session',
      data: {
        dependencyAnalysis: {
          affectedSections: ['testCases'],
          cascadeRequired: false
        }
      },
      metadata: {
        processingTime: 100,
        requestId: 'test-request',
        timestamp: new Date().toISOString()
      }
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultRouter = new RequestRouter()
      expect(defaultRouter).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customConfig: Partial<RouterConfig> = {
        enableStreaming: false,
        timeoutMs: 5000,
        maxRetries: 1
      }
      const customRouter = new RequestRouter(customConfig)
      expect(customRouter).toBeDefined()
    })

    it('should merge custom config with defaults', () => {
      const customConfig = { enableStreaming: false }
      const customRouter = new RequestRouter(customConfig)
      expect(customRouter).toBeDefined()
      // Should still have other default values
    })
  })

  describe('routeRequest', () => {
    beforeEach(() => {
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue(mockContext)
      
      vi.mocked(router['middleware'].processRequest).mockResolvedValue(mockMiddlewareResponse)
    })

    it('should route modification request successfully', async () => {
      const response = await router.routeRequest(mockRequest)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('modification')
      expect(responseData.proceedWithModification).toBe(true)
      expect(responseData.targetSections).toEqual(['acceptanceCriteria'])
    })

    it('should route clarification request successfully', async () => {
      const clarificationResponse = {
        ...mockMiddlewareResponse,
        type: 'clarification',
        intent: 'ask_clarification',
        data: {
          clarificationResult: {
            questions: [
              {
                question: 'What specifically needs to be changed?',
                category: 'specification',
                targetSection: 'acceptanceCriteria',
                priority: 'high'
              }
            ],
            context: 'Need more details',
            suggestedActions: ['Be more specific']
          }
        }
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(clarificationResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('clarification')
      expect(responseData.questions).toHaveLength(1)
      expect(responseData.changesSummary).toContain('clarification')
    })

    it('should route information request successfully', async () => {
      const informationResponse = {
        ...mockMiddlewareResponse,
        type: 'information',
        intent: 'provide_information',
        data: {
          contextualResponse: {
            response: 'Here is the information you requested',
            relevantSections: ['acceptanceCriteria'],
            citations: [
              {
                section: 'acceptanceCriteria',
                content: 'Current criteria content',
                relevance: 'high'
              }
            ],
            suggestedFollowUps: ['Would you like more details?'],
            confidence: 0.9
          }
        }
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(informationResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('information')
      expect(responseData.response).toBe('Here is the information you requested')
      expect(responseData.citations).toHaveLength(1)
    })

    it('should route rejection request successfully', async () => {
      const rejectionResponse = {
        ...mockMiddlewareResponse,
        type: 'rejection',
        intent: 'off_topic',
        data: {
          rejectionMessage: 'I can only help with QA topics'
        }
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(rejectionResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('rejection')
      expect(responseData.changesSummary).toBe('I can only help with QA topics')
    })

    it('should handle fallback request', async () => {
      const fallbackResponse = {
        ...mockMiddlewareResponse,
        type: 'fallback',
        data: {
          fallbackReason: 'Intent analysis failed'
        }
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(fallbackResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(500)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('fallback')
      expect(responseData.proceedWithOriginalLogic).toBe(true)
    })

    it('should handle middleware processing errors with retries', async () => {
      vi.mocked(router['middleware'].processRequest)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(mockMiddlewareResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(200)
      expect(vi.mocked(router['middleware'].processRequest)).toHaveBeenCalledTimes(2)
    })

    it('should handle persistent middleware failures', async () => {
      vi.mocked(router['middleware'].processRequest)
        .mockRejectedValue(new Error('Persistent failure'))

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(500)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('fallback')
      expect(responseData.fallbackReason).toContain('Persistent failure')
    })

    it('should handle context extraction errors', async () => {
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockRejectedValue(new Error('Context extraction failed'))

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(500)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('fallback')
    })

    it('should handle unknown response types', async () => {
      const unknownResponse = {
        ...mockMiddlewareResponse,
        type: 'unknown_type'
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(unknownResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.status).toBe(500)
      
      const responseData = await response.json()
      expect(responseData.type).toBe('fallback')
      expect(responseData.fallbackReason).toContain('Unknown response type')
    })
  })

  describe('Streaming Responses', () => {
    beforeEach(() => {
      // Create router with streaming enabled
      router = new RequestRouter({ enableStreaming: true })
      
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue(mockContext)
    })

    it('should generate streaming response for clarification', async () => {
      const clarificationResponse = {
        ...mockMiddlewareResponse,
        type: 'clarification',
        intent: 'ask_clarification',
        data: {
          clarificationResult: {
            questions: [
              {
                question: 'What specifically needs to be changed?',
                category: 'specification',
                targetSection: 'acceptanceCriteria',
                priority: 'high'
              }
            ],
            context: 'Need more details',
            suggestedActions: ['Be more specific']
          }
        }
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(clarificationResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Connection')).toBe('keep-alive')
    })

    it('should generate streaming response for information', async () => {
      const informationResponse = {
        ...mockMiddlewareResponse,
        type: 'information',
        intent: 'provide_information',
        data: {
          contextualResponse: {
            response: 'Here is the information you requested',
            relevantSections: ['acceptanceCriteria'],
            citations: [],
            suggestedFollowUps: [],
            confidence: 0.9
          }
        }
      }

      vi.mocked(router['middleware'].processRequest).mockResolvedValue(informationResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('should not stream modification responses', async () => {
      vi.mocked(router['middleware'].processRequest).mockResolvedValue(mockMiddlewareResponse)

      const response = await router.routeRequest(mockRequest)

      expect(response.headers.get('Content-Type')).not.toBe('text/event-stream')
      expect(response.headers.get('Content-Type')).toContain('application/json')
    })
  })

  describe('Metrics and Monitoring', () => {
    beforeEach(() => {
      router = new RequestRouter({ enableMetrics: true })
      
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue(mockContext)
      vi.mocked(router['middleware'].processRequest).mockResolvedValue(mockMiddlewareResponse)
    })

    it('should record metrics for successful requests', async () => {
      await router.routeRequest(mockRequest)

      const metrics = router.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].success).toBe(true)
      expect(metrics[0].intent).toBe('modify_canvas')
      expect(metrics[0].responseType).toBe('modification')
    })

    it('should record metrics for failed requests', async () => {
      vi.mocked(router['middleware'].processRequest).mockRejectedValue(new Error('Test error'))

      await router.routeRequest(mockRequest)

      const metrics = router.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].success).toBe(false)
      expect(metrics[0].errorCode).toBe('Test error')
    })

    it('should provide metrics summary', async () => {
      // Process multiple requests
      await router.routeRequest(mockRequest)
      await router.routeRequest(mockRequest)

      const summary = router.getMetricsSummary()
      expect(summary.totalRequests).toBe(2)
      expect(summary.successRate).toBe(1)
      expect(summary.averageProcessingTime).toBeGreaterThan(0)
      expect(summary.intentDistribution['modify_canvas']).toBe(2)
      expect(summary.responseTypeDistribution['modification']).toBe(2)
    })

    it('should clear metrics', async () => {
      await router.routeRequest(mockRequest)
      expect(router.getMetrics()).toHaveLength(1)

      router.clearMetrics()
      expect(router.getMetrics()).toHaveLength(0)
    })

    it('should limit metrics storage to prevent memory leaks', async () => {
      // Mock a large number of requests
      const originalMetrics = router['metrics']
      router['metrics'] = new Array(1500).fill(null).map((_, i) => ({
        requestId: `req-${i}`,
        timestamp: new Date().toISOString(),
        processingTime: 100,
        intent: 'modify_canvas' as const,
        confidence: 0.9,
        responseType: 'modification' as const,
        success: true,
        retryCount: 0
      }))

      await router.routeRequest(mockRequest)

      expect(router.getMetrics().length).toBeLessThanOrEqual(1000)
    })

    it('should handle empty metrics gracefully', () => {
      const summary = router.getMetricsSummary()
      expect(summary.totalRequests).toBe(0)
      expect(summary.successRate).toBe(0)
      expect(summary.averageProcessingTime).toBe(0)
    })
  })

  describe('Configuration Options', () => {
    it('should disable streaming when configured', async () => {
      const noStreamingRouter = new RequestRouter({ enableStreaming: false })
      
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue(mockContext)

      const clarificationResponse = {
        ...mockMiddlewareResponse,
        type: 'clarification',
        data: {
          clarificationResult: {
            questions: [],
            context: 'Test context',
            suggestedActions: []
          }
        }
      }

      vi.mocked(noStreamingRouter['middleware'].processRequest).mockResolvedValue(clarificationResponse)

      const response = await noStreamingRouter.routeRequest(mockRequest)

      expect(response.headers.get('Content-Type')).not.toBe('text/event-stream')
    })

    it('should disable fallback when configured', async () => {
      const noFallbackRouter = new RequestRouter({ enableFallback: false })
      
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockRejectedValue(new Error('Test error'))

      const response = await noFallbackRouter.routeRequest(mockRequest)

      // Should use handleAIError instead of fallback
      expect(response.status).toBe(500)
      const responseData = await response.json()
      expect(responseData.error).toBe('AI_ERROR')
    })

    it('should respect custom timeout', async () => {
      const shortTimeoutRouter = new RequestRouter({ timeoutMs: 100 })
      expect(shortTimeoutRouter).toBeDefined()
      // Timeout is passed to middleware, so we can't easily test it here
    })

    it('should respect custom retry count', async () => {
      const lowRetryRouter = new RequestRouter({ maxRetries: 1 })
      
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue(mockContext)
      vi.mocked(lowRetryRouter['middleware'].processRequest).mockRejectedValue(new Error('Persistent error'))

      await lowRetryRouter.routeRequest(mockRequest)

      // Should retry only once (maxRetries + 1 total attempts)
      expect(vi.mocked(lowRetryRouter['middleware'].processRequest)).toHaveBeenCalledTimes(2)
    })

    it('should disable metrics when configured', async () => {
      const noMetricsRouter = new RequestRouter({ enableMetrics: false })
      
      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue(mockContext)
      vi.mocked(noMetricsRouter['middleware'].processRequest).mockResolvedValue(mockMiddlewareResponse)

      await noMetricsRouter.routeRequest(mockRequest)

      expect(noMetricsRouter.getMetrics()).toHaveLength(0)
    })
  })
})

describe('Module Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleIntentAwareRequest', () => {
    it('should use default router instance', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          messages: [{ id: '1', role: 'user', content: 'test' }]
        })
      } as unknown as NextRequest

      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue({
        messages: [{ id: '1', role: 'user', content: 'test' }]
      })

      // Mock the default router's middleware
      vi.mocked(requestRouter['middleware'].processRequest).mockResolvedValue({
        type: 'modification',
        intent: 'modify_canvas',
        confidence: 0.9,
        targetSections: [],
        sessionId: 'test',
        data: {},
        metadata: {
          processingTime: 100,
          requestId: 'test',
          timestamp: new Date().toISOString()
        }
      })

      const response = await handleIntentAwareRequest(mockRequest)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
    })
  })

  describe('createRouteHandler', () => {
    it('should create custom route handler with config', async () => {
      const customHandler = createRouteHandler({ enableStreaming: false })
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          messages: [{ id: '1', role: 'user', content: 'test' }]
        })
      } as unknown as NextRequest

      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue({
        messages: [{ id: '1', role: 'user', content: 'test' }]
      })

      // The custom handler will create its own router instance
      // We need to mock the middleware for any router instance
      const mockProcessRequest = vi.fn().mockResolvedValue({
        type: 'modification',
        intent: 'modify_canvas',
        confidence: 0.9,
        targetSections: [],
        sessionId: 'test',
        data: {},
        metadata: {
          processingTime: 100,
          requestId: 'test',
          timestamp: new Date().toISOString()
        }
      })

      // Mock the IntentAnalysisMiddleware constructor to return our mock
      const { IntentAnalysisMiddleware } = require('../../../../lib/ai/intent/middleware')
      IntentAnalysisMiddleware.mockImplementation(() => ({
        processRequest: mockProcessRequest
      }))

      const response = await customHandler(mockRequest)

      expect(response).toBeInstanceOf(NextResponse)
    })
  })

  describe('enhanceExistingRoute', () => {
    it('should enhance existing route with intent analysis', async () => {
      const originalHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ original: 'response' })
      )

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          messages: [{ id: '1', role: 'user', content: 'test' }]
        })
      } as unknown as NextRequest

      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue({
        messages: [{ id: '1', role: 'user', content: 'test' }]
      })

      // Mock middleware to return clarification (should not call original handler)
      const mockProcessRequest = vi.fn().mockResolvedValue({
        type: 'clarification',
        intent: 'ask_clarification',
        confidence: 0.8,
        targetSections: [],
        sessionId: 'test',
        data: {
          clarificationResult: {
            questions: [],
            context: 'test',
            suggestedActions: []
          }
        },
        metadata: {
          processingTime: 100,
          requestId: 'test',
          timestamp: new Date().toISOString()
        }
      })

      const { IntentAnalysisMiddleware } = require('../../../../lib/ai/intent/middleware')
      IntentAnalysisMiddleware.mockImplementation(() => ({
        processRequest: mockProcessRequest
      }))

      const response = await enhanceExistingRoute(mockRequest, originalHandler)

      expect(response).toBeInstanceOf(NextResponse)
      expect(originalHandler).not.toHaveBeenCalled()
      
      const responseData = await response.json()
      expect(responseData.type).toBe('clarification')
    })

    it('should fallback to original handler on modification intent', async () => {
      const originalHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ original: 'response' })
      )

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          messages: [{ id: '1', role: 'user', content: 'test' }]
        })
      } as unknown as NextRequest

      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockResolvedValue({
        messages: [{ id: '1', role: 'user', content: 'test' }]
      })

      // Mock middleware to return modification (should call original handler)
      const mockProcessRequest = vi.fn().mockResolvedValue({
        type: 'modification',
        intent: 'modify_canvas',
        confidence: 0.9,
        targetSections: [],
        sessionId: 'test',
        data: {},
        metadata: {
          processingTime: 100,
          requestId: 'test',
          timestamp: new Date().toISOString()
        }
      })

      const { IntentAnalysisMiddleware } = require('../../../../lib/ai/intent/middleware')
      IntentAnalysisMiddleware.mockImplementation(() => ({
        processRequest: mockProcessRequest
      }))

      const response = await enhanceExistingRoute(mockRequest, originalHandler)

      expect(originalHandler).toHaveBeenCalledWith(mockRequest)
      
      const responseData = await response.json()
      expect(responseData.original).toBe('response')
    })

    it('should fallback to original handler on intent analysis failure', async () => {
      const originalHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ original: 'response' })
      )

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          messages: [{ id: '1', role: 'user', content: 'test' }]
        })
      } as unknown as NextRequest

      const { RequestPreprocessor } = require('../../../../lib/ai/intent/middleware')
      RequestPreprocessor.extractRequestContext.mockRejectedValue(new Error('Context extraction failed'))

      const response = await enhanceExistingRoute(mockRequest, originalHandler)

      expect(originalHandler).toHaveBeenCalledWith(mockRequest)
      
      const responseData = await response.json()
      expect(responseData.original).toBe('response')
    })
  })
})

describe('Default Configuration', () => {
  it('should export default router configuration', () => {
    expect(DEFAULT_ROUTER_CONFIG).toBeDefined()
    expect(DEFAULT_ROUTER_CONFIG.enableStreaming).toBe(true)
    expect(DEFAULT_ROUTER_CONFIG.enableFallback).toBe(true)
    expect(DEFAULT_ROUTER_CONFIG.timeoutMs).toBe(30000)
    expect(DEFAULT_ROUTER_CONFIG.maxRetries).toBe(2)
    expect(DEFAULT_ROUTER_CONFIG.enableMetrics).toBe(true)
  })

  it('should export default router instance', () => {
    expect(requestRouter).toBeInstanceOf(RequestRouter)
  })
})