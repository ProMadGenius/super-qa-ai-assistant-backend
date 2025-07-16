import {
  ticketAnalysisPayloadSchema,
  analyzeTicketRequestSchema,
  validateTicketAnalysisPayload,
  validateAnalyzeTicketRequest,
  type TicketAnalysisPayload,
  type AnalyzeTicketRequest
} from '@/lib/schemas/TicketAnalysisPayload'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'
import type { JiraTicket } from '@/lib/schemas/JiraTicket'
import { describe, it, expect } from 'vitest'

describe('TicketAnalysisPayload Schema Validation', () => {
  const validJiraTicket: JiraTicket = {
    issueKey: 'PROJ-123',
    summary: 'Fix login button not working',
    description: 'The login button on the homepage is not responding to clicks',
    status: 'In Progress',
    priority: 'Priority: High',
    issueType: 'Bug',
    assignee: 'John Doe',
    reporter: 'Jane Smith',
    comments: [],
    attachments: [],
    components: ['Frontend'],
    customFields: {
      acceptance_criteria: 'Button should respond to clicks',
      story_points: '3'
    },
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  const validPayload: TicketAnalysisPayload = {
    qaProfile: defaultQAProfile,
    ticketJson: validJiraTicket
  }

  describe('ticketAnalysisPayloadSchema', () => {
    it('should validate valid ticket analysis payload', () => {
      const result = ticketAnalysisPayloadSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validPayload)
      }
    })

    it('should validate payload with custom QA profile', () => {
      const customPayload: TicketAnalysisPayload = {
        qaProfile: {
          qaCategories: {
            functional: true,
            ux: false,
            ui: true,
            negative: true,
            api: true,
            database: false,
            performance: false,
            security: true,
            mobile: false,
            accessibility: false
          },
          testCaseFormat: 'gherkin',
          autoRefresh: false,
          includeComments: true,
          includeImages: false,
          operationMode: 'online',
          showNotifications: false
        },
        ticketJson: validJiraTicket
      }

      const result = ticketAnalysisPayloadSchema.safeParse(customPayload)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(customPayload)
      }
    })

    it('should reject payload with invalid QA profile', () => {
      const invalidPayload = {
        qaProfile: {
          qaCategories: {
            functional: 'true', // string instead of boolean
            ux: false,
            ui: true,
            negative: true,
            api: true,
            database: false,
            performance: false,
            security: true,
            mobile: false,
            accessibility: false
          },
          testCaseFormat: 'steps'
        },
        ticketJson: validJiraTicket
      }

      const result = ticketAnalysisPayloadSchema.safeParse(invalidPayload)
      expect(result.success).toBe(false)
    })

    it('should reject payload with invalid Jira ticket', () => {
      const invalidPayload = {
        qaProfile: defaultQAProfile,
        ticketJson: {
          key: 'PROJ-123',
          summary: 'Test ticket'
          // missing required fields
        }
      }

      const result = ticketAnalysisPayloadSchema.safeParse(invalidPayload)
      expect(result.success).toBe(false)
    })

    it('should reject payload with missing fields', () => {
      const incompletePayload = {
        qaProfile: defaultQAProfile
        // missing ticketJson
      }

      const result = ticketAnalysisPayloadSchema.safeParse(incompletePayload)
      expect(result.success).toBe(false)
    })
  })

  describe('analyzeTicketRequestSchema', () => {
    it('should validate request with optional metadata', () => {
      const requestWithMetadata: AnalyzeTicketRequest = {
        ...validPayload,
        requestId: 'req-123-456',
        clientVersion: '1.0.0',
        userAgent: 'Mozilla/5.0 (Chrome Extension)'
      }

      const result = analyzeTicketRequestSchema.safeParse(requestWithMetadata)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(requestWithMetadata)
      }
    })

    it('should validate request without optional metadata', () => {
      const result = analyzeTicketRequestSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validPayload)
      }
    })

    it('should validate request with partial metadata', () => {
      const requestWithPartialMetadata = {
        ...validPayload,
        requestId: 'req-789',
        clientVersion: '1.2.0'
        // userAgent not provided
      }

      const result = analyzeTicketRequestSchema.safeParse(requestWithPartialMetadata)
      expect(result.success).toBe(true)
    })
  })

  describe('Helper Functions', () => {
    describe('validateTicketAnalysisPayload', () => {
      it('should return success for valid payload', () => {
        const result = validateTicketAnalysisPayload(validPayload)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(validPayload)
        }
      })

      it('should return error for invalid payload', () => {
        const invalidPayload = {
          qaProfile: 'invalid',
          ticketJson: 'also invalid'
        }

        const result = validateTicketAnalysisPayload(invalidPayload)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues).toBeDefined()
          expect(result.error.issues.length).toBeGreaterThan(0)
        }
      })

      it('should provide detailed error information', () => {
        const invalidPayload = {
          qaProfile: {
            qaCategories: {
              functional: 'not-boolean'
            },
            testCaseFormat: 'invalid-format'
          },
          ticketJson: {
            key: 'PROJ-123'
            // missing required fields
          }
        }

        const result = validateTicketAnalysisPayload(invalidPayload)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0)
          // Should have multiple validation errors
          const errorPaths = result.error.issues.map(issue => issue.path.join('.'))
          expect(errorPaths.some(path => path.includes('qaProfile'))).toBe(true)
          expect(errorPaths.some(path => path.includes('ticketJson'))).toBe(true)
        }
      })
    })

    describe('validateAnalyzeTicketRequest', () => {
      it('should return success for valid request', () => {
        const validRequest: AnalyzeTicketRequest = {
          ...validPayload,
          requestId: 'req-test-123'
        }

        const result = validateAnalyzeTicketRequest(validRequest)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(validRequest)
        }
      })

      it('should return error for invalid request', () => {
        const invalidRequest = {
          qaProfile: null,
          ticketJson: undefined
        }

        const result = validateAnalyzeTicketRequest(invalidRequest)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(validateTicketAnalysisPayload(null).success).toBe(false)
      expect(validateTicketAnalysisPayload(undefined).success).toBe(false)
      expect(validateAnalyzeTicketRequest(null).success).toBe(false)
      expect(validateAnalyzeTicketRequest(undefined).success).toBe(false)
    })

    it('should handle empty objects', () => {
      expect(validateTicketAnalysisPayload({}).success).toBe(false)
      expect(validateAnalyzeTicketRequest({}).success).toBe(false)
    })

    it('should handle arrays instead of objects', () => {
      expect(validateTicketAnalysisPayload([]).success).toBe(false)
      expect(validateAnalyzeTicketRequest([]).success).toBe(false)
    })

    it('should handle primitive values', () => {
      expect(validateTicketAnalysisPayload('string').success).toBe(false)
      expect(validateTicketAnalysisPayload(123).success).toBe(false)
      expect(validateTicketAnalysisPayload(true).success).toBe(false)
    })
  })
})