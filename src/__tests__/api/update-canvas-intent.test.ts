/**
 * Integration tests for enhanced /api/update-canvas endpoint with intent analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/update-canvas/route'
import { NextRequest } from 'next/server'
import type { QACanvasDocument } from '../../lib/schemas/QACanvasDocument'
import type { JiraTicket } from '../../lib/schemas/JiraTicket'

// Mock the AI components
vi.mock('../../lib/ai/intent')
vi.mock('../../lib/ai/providerFailover')

describe('/api/update-canvas with Intent Analysis', () => {
  const mockCanvas: QACanvasDocument = {
    ticketSummary: {
      problem: 'Test problem',
      solution: 'Test solution',
      context: 'Test context'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Test AC',
        description: 'Test acceptance criteria',
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
        estimatedTime: '5 minutes',
        testCase: {
          scenario: 'Test scenario',
          given: ['Given test condition'],
          when: ['When test action'],
          then: ['Then test result'],
          tags: ['@test']
        }
      }
    ],
    metadata: {
      ticketId: 'TEST-123',
      qaProfile: {},
      generatedAt: new Date().toISOString()
    }
  }

  const mockTicket: JiraTicket = {
    issueKey: 'TEST-123',
    summary: 'Test ticket',
    description: 'Test description',
    status: 'In Progress',
    priority: 'High',
    issueType: 'Bug',
    assignee: 'test-user',
    reporter: 'test-reporter',
    comments: [],
    attachments: [],
    components: [],
    customFields: {},
    scrapedAt: new Date().toISOString()
  }

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/update-canvas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Intent Classification', () => {
    it('should handle modify_canvas intent', async () => {
      const { IntentAnalyzer, DependencyAnalyzer } = await import('../../lib/ai/intent')
      const { generateTextWithFailover } = await import('../../lib/ai/providerFailover')

      const mockAnalyzeIntent = vi.fn().mockResolvedValue({
        intent: 'modify_canvas',
        confidence: 0.9,
        targetSections: ['acceptanceCriteria'],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium',
          conversationLength: 1,
          availableSections: ['ticketSummary', 'acceptanceCriteria', 'testCases']
        },
        reasoning: 'User wants to modify acceptance criteria',
        keywords: ['criteria', 'change'],
        shouldModifyCanvas: true,
        requiresClarification: false
      })

      mockAnalyzeDependencies.mockResolvedValue({
        affectedSections: ['acceptanceCriteria', 'testCases'],
        dependencies: [],
        cascadeRequired: false,
        impactAssessment: 'Low impact',
        conflictRisk: 'low'
      })

      mockGenerateTextWithFailover.mockResolvedValue({
        text: JSON.stringify({
          updatedDocument: mockCanvas,
          changesSummary: 'Updated acceptance criteria as requested'
        })
      })

      const request = createRequest({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Please update the acceptance criteria to be more specific',
            createdAt: new Date().toISOString()
          }
        ],
        currentDocument: mockCanvas,
        originalTicketData: mockTicket
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.updatedDocument).toBeDefined()
      expect(data.changesSummary).toContain('Updated acceptance criteria')
    })

    it('should handle ask_clarification intent', async () => {
      mockAnalyzeIntent.mockResolvedValue({
        intent: 'ask_clarification',
        confidence: 0.8,
        targetSections: ['acceptanceCriteria'],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium',
          conversationLength: 1,
          availableSections: ['ticketSummary', 'acceptanceCriteria', 'testCases']
        },
        reasoning: 'User request is too vague',
        keywords: ['wrong', 'fix'],
        shouldModifyCanvas: false,
        requiresClarification: true
      })

      mockGenerateClarificationQuestions.mockResolvedValue({
        questions: [
          {
            question: 'What specifically about the acceptance criteria needs to be changed?',
            category: 'specification',
            targetSection: 'acceptanceCriteria',
            priority: 'high'
          }
        ],
        context: 'Need more specific information about the requested changes',
        suggestedActions: ['Specify which criteria to modify', 'Provide examples'],
        estimatedClarificationTime: 2
      })

      const request = createRequest({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'This is wrong, fix it',
            createdAt: new Date().toISOString()
          }
        ],
        currentDocument: mockCanvas,
        originalTicketData: mockTicket
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.type).toBe('clarification')
      expect(data.questions).toHaveLength(1)
      expect(data.questions[0].question).toContain('What specifically')
      expect(data.sessionId).toBe('test-session-id')
    })

    it('should handle off_topic intent', async () => {
      mockAnalyzeIntent.mockResolvedValue({
        intent: 'off_topic',
        confidence: 0.95,
        targetSections: [],
        context: {
          hasCanvas: true,
          canvasComplexity: 'medium',
          conversationLength: 1,
          availableSections: ['ticketSummary', 'acceptanceCriteria', 'testCases']
        },
        reasoning: 'User is asking about unrelated topics',
        keywords: ['weather', 'sports'],
        shouldModifyCanvas: false,
        requiresClarification: false
      })

      const request = createRequest({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'What\'s the weather like today?',
            createdAt: new Date().toISOString()
          }
        ],
        currentDocument: mockCanvas,
        originalTicketData: mockTicket
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.type).toBe('rejection')
      expect(data.changesSummary).toContain('QA documentation')
      expect(data.changesSummary).toContain('testing-related questions')
    })
  })

  describe('Error Handling', () => {
    it('should fall back to original logic when intent analysis fails', async () => {
      mockAnalyzeIntent.mockRejectedValue(new Error('Intent analysis failed'))

      mockGenerateTextWithFailover.mockResolvedValue({
        text: JSON.stringify({
          updatedDocument: mockCanvas,
          changesSummary: 'Processed with fallback logic'
        })
      })

      const request = createRequest({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Update the test cases',
            createdAt: new Date().toISOString()
          }
        ],
        currentDocument: mockCanvas,
        originalTicketData: mockTicket
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.updatedDocument).toBeDefined()
      expect(data.changesSummary).toContain('fallback logic')
    })

    it('should handle invalid request format', async () => {
      const request = createRequest({
        messages: [], // Empty messages array should fail validation
        currentDocument: mockCanvas
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })
  })
})