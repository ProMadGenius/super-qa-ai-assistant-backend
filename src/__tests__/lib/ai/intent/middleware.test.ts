/**
 * Tests for Intent Analysis Middleware
 * Comprehensive testing of request processing pipeline and response generation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  IntentAnalysisMiddleware,
  RequestPreprocessor,
  ResponseFormatter,
  intentAnalysisMiddleware,
  type RequestContext,
  type MiddlewareResponse,
  type MiddlewareMessage,
  DEFAULT_MIDDLEWARE_CONFIG
} from '../../../../lib/ai/intent/middleware'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { JiraTicket } from '../../../../lib/schemas/JiraTicket'

// Mock the intent analysis components
vi.mock('../../../../lib/ai/intent/intentAnalyzer', () => ({
  IntentAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeIntent: vi.fn()
  }))
}))

vi.mock('../../../../lib/ai/intent/sectionTargetDetector', () => ({
  SectionTargetDetector: vi.fn().mockImplementation(() => ({
    detectTargetSections: vi.fn()
  }))
}))

vi.mock('../../../../lib/ai/intent/dependencyAnalyzer', () => ({
  DependencyAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeDependencies: vi.fn()
  }))
}))

vi.mock('../../../../lib/ai/intent/clarificationGenerator', () => ({
  ClarificationGenerator: vi.fn().mockImplementation(() => ({
    generateClarificationQuestions: vi.fn()
  }))
}))

vi.mock('../../../../lib/ai/intent/contextualResponseGenerator', () => ({
  ContextualResponseGenerator: vi.fn().mockImplementation(() => ({
    generateContextualResponse: vi.fn()
  }))
}))

vi.mock('../../../../lib/ai/intent/conversationStateManager', () => ({
  conversationStateManager: {
    updateState: vi.fn()
  },
  generateSessionId: vi.fn(() => 'test-session-id')
}))

describe('IntentAnalysisMiddleware', () => {
  let middleware: IntentAnalysisMiddleware
  let mockMessages: MiddlewareMessage[]
  let mockCanvas: QACanvasDocument
  let mockTicket: JiraTicket
  let mockContext: RequestContext

  beforeEach(() => {
    vi.clearAllMocks()
    
    middleware = new IntentAnalysisMiddleware()
    
    mockMessages = [
      {
        id: '1',
        role: 'user',
        content: 'Los criterios de aceptación están mal definidos',
        createdAt: new Date().toISOString()
      }
    ]

    mockCanvas = {
      ticketSummary: {
        problem: 'Test problem',
        solution: 'Test solution',
        context: 'Test context'
      },
      acceptanceCriteria: [],
      testCases: [],
      configurationWarnings: [],
      metadata: {
        ticketId: 'TEST-123',
        qaProfile: {
          testCaseFormat: 'gherkin',
          qaCategories: {
            functional: true,
            ui: false,
            ux: false,
            negative: false,
            api: false,
            database: false,
            performance: false,
            security: false,
            mobile: false,
            accessibility: false
          },
          autoRefresh: true,
          includeComments: true,
          includeImages: true,
          operationMode: 'offline',
          showNotifications: true
        },
        generatedAt: new Date().toISOString(),
        documentVersion: '1.0'
      }
    } as QACanvasDocument

    mockTicket = {
      issueKey: 'TEST-123',
      summary: 'Test ticket',
      description: 'Test description',
      status: 'In Progress',
      priority: 'High',
      issueType: 'Bug',
      reporter: 'test@example.com',
      comments: [],
      attachments: [],
      components: [],
      customFields: {},
      scrapedAt: new Date().toISOString()
    } as JiraTicket

    mockContext = {
      messages: mockMessages,
      currentDocument: mockCanvas,
      originalTicketData: mockTicket,
      sessionId: 'test-session',
      userPreferences: {
        testCaseFormat: 'gherkin',
        focusAreas: ['functional']
      }
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultMiddleware = new IntentAnalysisMiddleware()
      expect(defaultMiddleware).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        enableIntentAnalysis: false,
        timeoutMs: 5000
      }
      const customMiddleware = new IntentAnalysisMiddleware(customConfig)
      expect(customMiddleware).toBeDefined()
    })

    it('should merge custom config with defaults', () => {
      const customConfig = { enableIntentAnalysis: false }
      const customMiddleware = new IntentAnalysisMiddleware(customConfig)
      // Should still have other default values
      expect(customMiddleware).toBeDefined()
    })
  })

  describe('processRequest', () => {
    it('should process request with modify_canvas intent', async () => {
      // Mock intent analyzer to return modify_canvas intent
      const mockIntentResult = {
        intent: 'modify_canvas' as const,
        confidence: 0.9,
        targetSections: ['acceptanceCriteria' as const],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User wants to modify acceptance criteria',
        keywords: ['criterios', 'aceptación'],
        shouldModifyCanvas: true,
        requiresClarification: false
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
      vi.mocked(middleware['dependencyAnalyzer'].analyzeDependencies).mockResolvedValue({
        affectedSections: ['testCases'],
        dependencies: [],
        cascadeRequired: false,
        impactAssessment: 'Low impact',
        conflictRisk: 'low'
      })

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('modification')
      expect(response.intent).toBe('modify_canvas')
      expect(response.confidence).toBe(0.9)
      expect(response.targetSections).toEqual(['acceptanceCriteria'])
      expect(response.sessionId).toBeDefined()
      expect(response.metadata.requestId).toBeDefined()
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0)
    })

    it('should process request with ask_clarification intent', async () => {
      const mockIntentResult = {
        intent: 'ask_clarification' as const,
        confidence: 0.8,
        targetSections: [],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User request is vague',
        keywords: ['mal'],
        shouldModifyCanvas: false,
        requiresClarification: true
      }

      const mockClarificationResult = {
        questions: [
          {
            question: '¿Qué específicamente está mal con los criterios?',
            category: 'specification' as const,
            targetSection: 'acceptanceCriteria' as const,
            priority: 'high' as const
          }
        ],
        context: 'Need more specific information',
        suggestedActions: ['Be more specific'],
        estimatedClarificationTime: 30
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
      vi.mocked(middleware['clarificationGenerator'].generateClarificationQuestions).mockResolvedValue(mockClarificationResult)

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('clarification')
      expect(response.intent).toBe('ask_clarification')
      expect(response.data.clarificationResult).toEqual(mockClarificationResult)
    })

    it('should process request with provide_information intent', async () => {
      const mockIntentResult = {
        intent: 'provide_information' as const,
        confidence: 0.85,
        targetSections: ['acceptanceCriteria' as const],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User wants information about criteria',
        keywords: ['explicar', 'criterios'],
        shouldModifyCanvas: false,
        requiresClarification: false
      }

      const mockContextualResponse = {
        response: 'Los criterios de aceptación definen...',
        relevantSections: ['acceptanceCriteria' as const],
        citations: [
          {
            section: 'acceptanceCriteria' as const,
            content: 'Current criteria content',
            relevance: 'high' as const
          }
        ],
        suggestedFollowUps: ['¿Necesitas más detalles?'],
        confidence: 0.9
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
      vi.mocked(middleware['contextualResponseGenerator'].generateContextualResponse).mockResolvedValue(mockContextualResponse)

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('information')
      expect(response.intent).toBe('provide_information')
      expect(response.data.contextualResponse).toEqual(mockContextualResponse)
    })

    it('should process request with off_topic intent', async () => {
      const mockIntentResult = {
        intent: 'off_topic' as const,
        confidence: 0.95,
        targetSections: [],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User asking about sports',
        keywords: ['fútbol', 'partido'],
        shouldModifyCanvas: false,
        requiresClarification: false
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('rejection')
      expect(response.intent).toBe('off_topic')
      expect(response.data.rejectionMessage).toContain('QA')
    })

    it('should handle intent analysis timeout', async () => {
      // Create middleware with short timeout
      const shortTimeoutMiddleware = new IntentAnalysisMiddleware({ timeoutMs: 100 })
      
      // Mock intent analyzer to take longer than timeout
      vi.mocked(shortTimeoutMiddleware['intentAnalyzer'].analyzeIntent).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      )

      const response = await shortTimeoutMiddleware.processRequest(mockContext)

      expect(response.type).toBe('clarification')
      expect(response.confidence).toBe(0.3)
    })

    it('should handle missing user message', async () => {
      const contextWithoutUserMessage = {
        ...mockContext,
        messages: [
          {
            id: '1',
            role: 'assistant' as const,
            content: 'System message',
            createdAt: new Date().toISOString()
          }
        ]
      }

      const response = await middleware.processRequest(contextWithoutUserMessage)

      expect(response.type).toBe('fallback')
      expect(response.data.fallbackReason).toContain('No user message found')
    })

    it('should handle intent analysis failure gracefully', async () => {
      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockRejectedValue(
        new Error('Intent analysis failed')
      )

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('fallback')
      expect(response.data.fallbackReason).toBeDefined()
    })

    it('should handle clarification generation failure', async () => {
      const mockIntentResult = {
        intent: 'ask_clarification' as const,
        confidence: 0.8,
        targetSections: [],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User request is vague',
        keywords: ['mal'],
        shouldModifyCanvas: false,
        requiresClarification: true
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
      vi.mocked(middleware['clarificationGenerator'].generateClarificationQuestions).mockRejectedValue(
        new Error('Clarification generation failed')
      )

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('fallback')
      expect(response.data.fallbackReason).toContain('Failed to generate clarification questions')
    })

    it('should handle contextual response generation failure', async () => {
      const mockIntentResult = {
        intent: 'provide_information' as const,
        confidence: 0.85,
        targetSections: ['acceptanceCriteria' as const],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User wants information',
        keywords: ['explicar'],
        shouldModifyCanvas: false,
        requiresClarification: false
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
      vi.mocked(middleware['contextualResponseGenerator'].generateContextualResponse).mockRejectedValue(
        new Error('Contextual response generation failed')
      )

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('fallback')
      expect(response.data.fallbackReason).toContain('Failed to generate contextual response')
    })

    it('should handle unknown intent type', async () => {
      const mockIntentResult = {
        intent: 'unknown_intent' as any,
        confidence: 0.5,
        targetSections: [],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'Unknown intent',
        keywords: [],
        shouldModifyCanvas: false,
        requiresClarification: false
      }

      vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)

      const response = await middleware.processRequest(mockContext)

      expect(response.type).toBe('fallback')
      expect(response.data.fallbackReason).toContain('Unknown intent type')
    })
  })

  describe('Configuration Options', () => {
    it('should skip intent analysis when disabled', async () => {
      const disabledMiddleware = new IntentAnalysisMiddleware({ 
        enableIntentAnalysis: false 
      })

      const response = await disabledMiddleware.processRequest(mockContext)

      expect(response.intent).toBe('modify_canvas')
      expect(response.confidence).toBe(0.5)
      // Should not call the actual intent analyzer
      expect(vi.mocked(disabledMiddleware['intentAnalyzer'].analyzeIntent)).not.toHaveBeenCalled()
    })

    it('should skip dependency analysis when disabled', async () => {
      const noDependencyMiddleware = new IntentAnalysisMiddleware({ 
        enableDependencyAnalysis: false 
      })

      const mockIntentResult = {
        intent: 'modify_canvas' as const,
        confidence: 0.9,
        targetSections: ['acceptanceCriteria' as const],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'User wants to modify',
        keywords: [],
        shouldModifyCanvas: true,
        requiresClarification: false
      }

      vi.mocked(noDependencyMiddleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)

      const response = await noDependencyMiddleware.processRequest(mockContext)

      expect(response.type).toBe('modification')
      expect(response.data.dependencyAnalysis).toBeNull()
    })

    it('should skip conversation state when disabled', async () => {
      const noStateMiddleware = new IntentAnalysisMiddleware({ 
        enableConversationState: false 
      })

      const mockIntentResult = {
        intent: 'ask_clarification' as const,
        confidence: 0.8,
        targetSections: [],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium' as const,
          conversationLength: 1,
          availableSections: []
        },
        reasoning: 'Need clarification',
        keywords: [],
        shouldModifyCanvas: false,
        requiresClarification: true
      }

      const mockClarificationResult = {
        questions: [],
        context: 'Test context',
        suggestedActions: [],
        estimatedClarificationTime: 30
      }

      vi.mocked(noStateMiddleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
      vi.mocked(noStateMiddleware['clarificationGenerator'].generateClarificationQuestions).mockResolvedValue(mockClarificationResult)

      await noStateMiddleware.processRequest(mockContext)

      // Should not update conversation state
      const { conversationStateManager } = await import('../../../../lib/ai/intent/conversationStateManager')
      expect(conversationStateManager.updateState).not.toHaveBeenCalled()
    })
  })
})

describe('RequestPreprocessor', () => {
  describe('extractRequestContext', () => {
    it('should extract context from valid request', async () => {
      const mockRequestBody = {
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
            qaProfile: {
              testCaseFormat: 'gherkin',
              qaCategories: {
                functional: true,
                ui: false
              }
            }
          }
        },
        sessionId: 'test-session'
      }

      const mockRequest = {
        json: vi.fn().mockResolvedValue(mockRequestBody)
      } as unknown as NextRequest

      const context = await RequestPreprocessor.extractRequestContext(mockRequest)

      expect(context.messages).toHaveLength(1)
      expect(context.messages[0].role).toBe('user')
      expect(context.sessionId).toBe('test-session')
      expect(context.userPreferences?.testCaseFormat).toBe('gherkin')
      expect(context.userPreferences?.focusAreas).toEqual(['functional'])
    })

    it('should handle request without messages', async () => {
      const mockRequestBody = {}

      const mockRequest = {
        json: vi.fn().mockResolvedValue(mockRequestBody)
      } as unknown as NextRequest

      const context = await RequestPreprocessor.extractRequestContext(mockRequest)

      expect(context.messages).toEqual([])
      expect(context.currentDocument).toBeUndefined()
      expect(context.sessionId).toBeUndefined()
    })

    it('should handle malformed request', async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest

      await expect(RequestPreprocessor.extractRequestContext(mockRequest))
        .rejects.toThrow('Failed to extract request context')
    })

    it('should normalize messages without IDs', async () => {
      const mockRequestBody = {
        messages: [
          {
            role: 'user',
            content: 'Test message'
          }
        ]
      }

      const mockRequest = {
        json: vi.fn().mockResolvedValue(mockRequestBody)
      } as unknown as NextRequest

      const context = await RequestPreprocessor.extractRequestContext(mockRequest)

      expect(context.messages[0].id).toBeDefined()
      expect(context.messages[0].role).toBe('user')
      expect(context.messages[0].content).toBe('Test message')
    })
  })
})

describe('ResponseFormatter', () => {
  describe('formatResponse', () => {
    it('should format clarification response', async () => {
      const middlewareResponse: MiddlewareResponse = {
        type: 'clarification',
        intent: 'ask_clarification',
        confidence: 0.8,
        targetSections: [],
        sessionId: 'test-session',
        data: {
          clarificationResult: {
            questions: [
              {
                question: 'Test question?',
                category: 'specification',
                targetSection: 'acceptanceCriteria',
                priority: 'high'
              }
            ],
            context: 'Test context',
            suggestedActions: ['Be specific'],
            estimatedClarificationTime: 30
          }
        },
        metadata: {
          processingTime: 100,
          requestId: 'test-request',
          timestamp: new Date().toISOString()
        }
      }

      const response = ResponseFormatter.formatResponse(middlewareResponse)

      expect(response.status).toBe(200)
      
      // Parse the response body to check content
      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      expect(responseData.type).toBe('clarification')
      expect(responseData.questions).toHaveLength(1)
      expect(responseData.sessionId).toBe('test-session')
    })

    it('should format information response', async () => {
      const middlewareResponse: MiddlewareResponse = {
        type: 'information',
        intent: 'provide_information',
        confidence: 0.9,
        targetSections: ['acceptanceCriteria'],
        sessionId: 'test-session',
        data: {
          contextualResponse: {
            response: 'Test information response',
            relevantSections: ['acceptanceCriteria'],
            citations: [],
            suggestedFollowUps: [],
            confidence: 0.9
          }
        },
        metadata: {
          processingTime: 150,
          requestId: 'test-request',
          timestamp: new Date().toISOString()
        }
      }

      const response = ResponseFormatter.formatResponse(middlewareResponse)

      expect(response.status).toBe(200)
      
      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      expect(responseData.type).toBe('information')
      expect(responseData.response).toBe('Test information response')
    })

    it('should format rejection response', async () => {
      const middlewareResponse: MiddlewareResponse = {
        type: 'rejection',
        intent: 'off_topic',
        confidence: 0.95,
        targetSections: [],
        sessionId: 'test-session',
        data: {
          rejectionMessage: 'I can only help with QA topics'
        },
        metadata: {
          processingTime: 50,
          requestId: 'test-request',
          timestamp: new Date().toISOString()
        }
      }

      const response = ResponseFormatter.formatResponse(middlewareResponse)

      expect(response.status).toBe(200)
      
      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      expect(responseData.type).toBe('rejection')
      expect(responseData.changesSummary).toBe('I can only help with QA topics')
    })

    it('should format modification response', async () => {
      const middlewareResponse: MiddlewareResponse = {
        type: 'modification',
        intent: 'modify_canvas',
        confidence: 0.9,
        targetSections: ['acceptanceCriteria'],
        sessionId: 'test-session',
        data: {
          dependencyAnalysis: {
            affectedSections: ['testCases'],
            cascadeRequired: true
          }
        },
        metadata: {
          processingTime: 200,
          requestId: 'test-request',
          timestamp: new Date().toISOString()
        }
      }

      const response = ResponseFormatter.formatResponse(middlewareResponse)

      expect(response.status).toBe(200)
      
      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      expect(responseData.type).toBe('modification')
      expect(responseData.proceedWithModification).toBe(true)
      expect(responseData.targetSections).toEqual(['acceptanceCriteria'])
    })

    it('should format fallback response', async () => {
      const middlewareResponse: MiddlewareResponse = {
        type: 'fallback',
        intent: 'modify_canvas',
        confidence: 0,
        targetSections: [],
        sessionId: 'test-session',
        data: {
          fallbackReason: 'Intent analysis failed'
        },
        metadata: {
          processingTime: 10,
          requestId: 'test-request',
          timestamp: new Date().toISOString()
        }
      }

      const response = ResponseFormatter.formatResponse(middlewareResponse)

      expect(response.status).toBe(200)
      
      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      expect(responseData.type).toBe('fallback')
      expect(responseData.proceedWithOriginalLogic).toBe(true)
    })

    it('should handle unknown response type', async () => {
      const middlewareResponse = {
        type: 'unknown' as any,
        intent: 'modify_canvas' as const,
        confidence: 0,
        targetSections: [],
        sessionId: 'test-session',
        data: {},
        metadata: {
          processingTime: 0,
          requestId: 'test-request',
          timestamp: new Date().toISOString()
        }
      }

      const response = ResponseFormatter.formatResponse(middlewareResponse)

      expect(response.status).toBe(500)
      
      const responseText = await response.text()
      const responseData = JSON.parse(responseText)
      expect(responseData.type).toBe('error')
    })
  })
})

describe('Default Middleware Instance', () => {
  it('should export default middleware instance', () => {
    expect(intentAnalysisMiddleware).toBeInstanceOf(IntentAnalysisMiddleware)
  })

  it('should use default configuration', () => {
    expect(intentAnalysisMiddleware).toBeDefined()
  })
})

describe('Integration Scenarios', () => {
  let middleware: IntentAnalysisMiddleware
  let mockContext: RequestContext

  beforeEach(() => {
    vi.clearAllMocks()
    middleware = new IntentAnalysisMiddleware()
    
    mockContext = {
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Los criterios de aceptación están mal definidos',
          createdAt: new Date().toISOString()
        }
      ],
      currentDocument: {
        ticketSummary: {
          problem: 'Test problem',
          solution: 'Test solution',
          context: 'Test context'
        },
        acceptanceCriteria: [],
        testCases: [],
        configurationWarnings: [],
        metadata: {
          ticketId: 'TEST-123',
          qaProfile: {
            testCaseFormat: 'gherkin',
            qaCategories: {
              functional: true,
              ui: false,
              ux: false,
              negative: false,
              api: false,
              database: false,
              performance: false,
              security: false,
              mobile: false,
              accessibility: false
            },
            autoRefresh: true,
            includeComments: true,
            includeImages: true,
            operationMode: 'offline',
            showNotifications: true
          },
          generatedAt: new Date().toISOString(),
          documentVersion: '1.0'
        }
      } as QACanvasDocument,
      originalTicketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        status: 'In Progress',
        priority: 'High',
        issueType: 'Bug',
        reporter: 'test@example.com',
        comments: [],
        attachments: [],
        components: [],
        customFields: {},
        scrapedAt: new Date().toISOString()
      } as JiraTicket,
      sessionId: 'test-session',
      userPreferences: {
        testCaseFormat: 'gherkin',
        focusAreas: ['functional']
      }
    }
  })

  it('should handle complete request processing pipeline', async () => {
    const mockIntentResult = {
      intent: 'modify_canvas' as const,
      confidence: 0.9,
      targetSections: ['acceptanceCriteria' as const],
      context: {
        hasCanvas: true,
        canvasComplexity: 'medium' as const,
        conversationLength: 1,
        availableSections: []
      },
      reasoning: 'User wants to modify acceptance criteria',
      keywords: ['criterios'],
      shouldModifyCanvas: true,
      requiresClarification: false
    }

    const mockDependencyResult = {
      affectedSections: ['testCases' as const],
      dependencies: [],
      cascadeRequired: true,
      impactAssessment: 'Medium impact',
      conflictRisk: 'low' as const
    }

    vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
    vi.mocked(middleware['dependencyAnalyzer'].analyzeDependencies).mockResolvedValue(mockDependencyResult)

    const response = await middleware.processRequest(mockContext)

    expect(response.type).toBe('modification')
    expect(response.data.dependencyAnalysis).toEqual(mockDependencyResult)
    expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0)
  })

  it('should handle multi-step clarification flow', async () => {
    const mockIntentResult = {
      intent: 'ask_clarification' as const,
      confidence: 0.8,
      targetSections: ['acceptanceCriteria' as const],
      context: {
        hasCanvas: true,
        canvasComplexity: 'medium' as const,
        conversationLength: 1,
        availableSections: []
      },
      reasoning: 'Need more details',
      keywords: ['mal'],
      shouldModifyCanvas: false,
      requiresClarification: true
    }

    const mockClarificationResult = {
      questions: [
        {
          question: '¿Qué específicamente está mal?',
          category: 'specification' as const,
          targetSection: 'acceptanceCriteria' as const,
          priority: 'high' as const
        },
        {
          question: '¿Qué resultado esperas?',
          category: 'scope' as const,
          targetSection: 'acceptanceCriteria' as const,
          priority: 'medium' as const
        }
      ],
      context: 'Multiple clarifications needed',
      suggestedActions: ['Be more specific', 'Provide examples'],
      estimatedClarificationTime: 60
    }

    vi.mocked(middleware['intentAnalyzer'].analyzeIntent).mockResolvedValue(mockIntentResult)
    vi.mocked(middleware['clarificationGenerator'].generateClarificationQuestions).mockResolvedValue(mockClarificationResult)

    const response = await middleware.processRequest(mockContext)

    expect(response.type).toBe('clarification')
    expect(response.data.clarificationResult?.questions).toHaveLength(2)
    expect(response.data.clarificationResult?.estimatedClarificationTime).toBe(60)
  })
})