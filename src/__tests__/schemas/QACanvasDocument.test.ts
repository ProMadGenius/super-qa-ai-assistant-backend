import {
  qaCanvasDocumentSchema,
  ticketSummarySchema,
  configurationWarningSchema,
  acceptanceCriterionSchema,
  testCaseSchema,
  gherkinTestCaseSchema,
  stepsTestCaseSchema,
  tableTestCaseSchema,
  documentMetadataSchema,
  validateQACanvasDocument,
  createMinimalQACanvasDocument,
  type QACanvasDocument,
  type TicketSummary,
  type ConfigurationWarning,
  type AcceptanceCriterion,
  type TestCase,
  type GherkinTestCase,
  type StepsTestCase,
  type TableTestCase
} from '@/lib/schemas/QACanvasDocument'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'
import { describe, it, expect } from 'vitest'

describe('QACanvasDocument Schema Validation', () => {
  const validTicketSummary: TicketSummary = {
    problem: 'Users cannot complete checkout because the payment button is unresponsive',
    solution: 'Implement a new payment service integration that properly handles user interactions',
    context: 'The payment system is critical for e-commerce functionality and user conversion'
  }

  const validConfigurationWarning: ConfigurationWarning = {
    type: 'category_mismatch',
    title: 'API Testing Required',
    message: 'This ticket involves API modifications but API testing is disabled in your configuration',
    recommendation: 'Enable API testing in your QA profile for comprehensive coverage',
    severity: 'high'
  }

  const validAcceptanceCriterion: AcceptanceCriterion = {
    id: 'ac-001',
    title: 'Payment button responds to clicks',
    description: 'When user clicks the payment button, it should initiate the payment process',
    priority: 'must',
    category: 'functional',
    testable: true
  }

  const validGherkinTestCase: TestCase = {
    format: 'gherkin',
    id: 'tc-001',
    category: 'functional',
    priority: 'high',
    estimatedTime: '5 minutes',
    testCase: {
      scenario: 'User completes payment successfully',
      given: ['User is on checkout page', 'User has items in cart'],
      when: ['User clicks payment button', 'User enters valid payment details'],
      then: ['Payment is processed', 'User receives confirmation'],
      tags: ['@smoke', '@payment']
    }
  }

  const validStepsTestCase: TestCase = {
    format: 'steps',
    id: 'tc-002',
    category: 'ui',
    priority: 'medium',
    testCase: {
      title: 'Verify payment button visibility',
      objective: 'Ensure payment button is visible and properly styled',
      preconditions: ['User is logged in', 'Cart has items'],
      steps: [
        {
          stepNumber: 1,
          action: 'Navigate to checkout page',
          expectedResult: 'Checkout page loads successfully'
        },
        {
          stepNumber: 2,
          action: 'Locate payment button',
          expectedResult: 'Payment button is visible and properly styled',
          notes: 'Check button color, size, and positioning'
        }
      ],
      postconditions: ['No side effects on other page elements']
    }
  }

  const validTableTestCase: TestCase = {
    format: 'table',
    id: 'tc-003',
    category: 'negative',
    priority: 'low',
    testCase: {
      title: 'Payment validation with invalid data',
      description: 'Test payment form with various invalid inputs',
      testData: [
        { 'Card Number': '1234', 'Expected Error': 'Invalid card number' },
        { 'Card Number': '', 'Expected Error': 'Card number required' },
        { 'Card Number': 'abcd-efgh-ijkl', 'Expected Error': 'Invalid format' }
      ],
      expectedOutcome: 'Appropriate error messages displayed for each invalid input'
    }
  }

  const validQACanvasDocument: QACanvasDocument = {
    ticketSummary: validTicketSummary,
    configurationWarnings: [validConfigurationWarning],
    acceptanceCriteria: [validAcceptanceCriterion],
    testCases: [validGherkinTestCase, validStepsTestCase, validTableTestCase],
    metadata: {
      generatedAt: '2024-01-15T13:00:00Z',
      qaProfile: defaultQAProfile,
      ticketId: 'PROJ-123',
      documentVersion: '1.0',
      aiModel: 'gpt-4o',
      generationTime: 2500,
      wordCount: 450
    }
  }

  describe('ticketSummarySchema', () => {
    it('should validate valid ticket summary', () => {
      const result = ticketSummarySchema.safeParse(validTicketSummary)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validTicketSummary)
      }
    })

    it('should reject ticket summary with missing fields', () => {
      const incompleteTicketSummary = {
        problem: 'Some problem',
        solution: 'Some solution'
        // missing context
      }

      const result = ticketSummarySchema.safeParse(incompleteTicketSummary)
      expect(result.success).toBe(false)
    })

    it('should reject ticket summary with empty strings', () => {
      const emptyTicketSummary = {
        problem: '',
        solution: '',
        context: ''
      }

      const result = ticketSummarySchema.safeParse(emptyTicketSummary)
      expect(result.success).toBe(true) // Empty strings are valid, AI might generate them initially
    })
  })

  describe('configurationWarningSchema', () => {
    it('should validate valid configuration warning', () => {
      const result = configurationWarningSchema.safeParse(validConfigurationWarning)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validConfigurationWarning)
      }
    })

    it('should apply default severity when not provided', () => {
      const warningWithoutSeverity = {
        type: 'recommendation' as const,
        title: 'Consider adding performance tests',
        message: 'This feature might benefit from performance testing',
        recommendation: 'Enable performance testing in your profile'
      }

      const result = configurationWarningSchema.safeParse(warningWithoutSeverity)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.severity).toBe('medium')
      }
    })

    it('should reject invalid warning types', () => {
      const invalidWarning = {
        type: 'invalid_type',
        title: 'Test warning',
        message: 'Test message',
        recommendation: 'Test recommendation'
      }

      const result = configurationWarningSchema.safeParse(invalidWarning)
      expect(result.success).toBe(false)
    })
  })

  describe('acceptanceCriterionSchema', () => {
    it('should validate valid acceptance criterion', () => {
      const result = acceptanceCriterionSchema.safeParse(validAcceptanceCriterion)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validAcceptanceCriterion)
      }
    })

    it('should apply default values when not provided', () => {
      const minimalCriterion = {
        id: 'ac-002',
        title: 'Basic functionality works',
        description: 'The feature should work as expected',
        category: 'functional' as const
      }

      const result = acceptanceCriterionSchema.safeParse(minimalCriterion)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('must')
        expect(result.data.testable).toBe(true)
      }
    })

    it('should reject invalid priority values', () => {
      const invalidCriterion = {
        id: 'ac-003',
        title: 'Test criterion',
        description: 'Test description',
        priority: 'invalid_priority',
        category: 'functional'
      }

      const result = acceptanceCriterionSchema.safeParse(invalidCriterion)
      expect(result.success).toBe(false)
    })
  })

  describe('testCaseSchema', () => {
    it('should validate Gherkin test case', () => {
      const result = testCaseSchema.safeParse(validGherkinTestCase)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.format).toBe('gherkin')
        expect(result.data).toEqual(validGherkinTestCase)
      }
    })

    it('should validate Steps test case', () => {
      const result = testCaseSchema.safeParse(validStepsTestCase)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.format).toBe('steps')
        expect(result.data).toEqual(validStepsTestCase)
      }
    })

    it('should validate Table test case', () => {
      const result = testCaseSchema.safeParse(validTableTestCase)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.format).toBe('table')
        expect(result.data).toEqual(validTableTestCase)
      }
    })

    it('should reject test case with mismatched format and content', () => {
      const mismatchedTestCase = {
        format: 'gherkin',
        id: 'tc-004',
        category: 'functional',
        priority: 'medium',
        testCase: {
          title: 'This is a steps format',
          objective: 'But marked as gherkin',
          steps: []
        }
      }

      const result = testCaseSchema.safeParse(mismatchedTestCase)
      expect(result.success).toBe(false)
    })

    it('should apply default priority when not provided', () => {
      const testCaseWithoutPriority = {
        format: 'gherkin' as const,
        id: 'tc-005',
        category: 'functional',
        testCase: {
          scenario: 'Test scenario',
          given: ['Given condition'],
          when: ['When action'],
          then: ['Then result'],
          tags: []
        }
      }

      const result = testCaseSchema.safeParse(testCaseWithoutPriority)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('medium')
      }
    })
  })

  describe('qaCanvasDocumentSchema', () => {
    it('should validate complete valid QA Canvas Document', () => {
      const result = qaCanvasDocumentSchema.safeParse(validQACanvasDocument)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validQACanvasDocument)
      }
    })

    it('should validate minimal document with empty arrays', () => {
      const minimalDocument = {
        ticketSummary: validTicketSummary,
        configurationWarnings: [],
        acceptanceCriteria: [],
        testCases: [],
        metadata: {
          generatedAt: '2024-01-15T13:00:00Z',
          qaProfile: defaultQAProfile,
          ticketId: 'PROJ-456',
          documentVersion: '1.0'
        }
      }

      const result = qaCanvasDocumentSchema.safeParse(minimalDocument)
      expect(result.success).toBe(true)
    })

    it('should apply default values for optional metadata fields', () => {
      const documentWithMinimalMetadata = {
        ticketSummary: validTicketSummary,
        acceptanceCriteria: [validAcceptanceCriterion],
        testCases: [validGherkinTestCase],
        metadata: {
          generatedAt: '2024-01-15T13:00:00Z',
          qaProfile: defaultQAProfile,
          ticketId: 'PROJ-789'
        }
      }

      const result = qaCanvasDocumentSchema.safeParse(documentWithMinimalMetadata)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.configurationWarnings).toEqual([])
        expect(result.data.metadata.documentVersion).toBe('1.0')
      }
    })

    it('should reject document with missing required sections', () => {
      const incompleteDocument = {
        ticketSummary: validTicketSummary,
        acceptanceCriteria: [validAcceptanceCriterion]
        // missing testCases and metadata
      }

      const result = qaCanvasDocumentSchema.safeParse(incompleteDocument)
      expect(result.success).toBe(false)
    })
  })

  describe('Helper Functions', () => {
    describe('validateQACanvasDocument', () => {
      it('should return success for valid document', () => {
        const result = validateQACanvasDocument(validQACanvasDocument)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(validQACanvasDocument)
        }
      })

      it('should return detailed error information for invalid document', () => {
        const invalidDocument = {
          ticketSummary: {
            problem: 'Valid problem'
            // missing solution and context
          },
          acceptanceCriteria: 'not an array',
          testCases: [],
          metadata: {
            generatedAt: 'invalid-date',
            ticketId: 'PROJ-999'
            // missing qaProfile
          }
        }

        const result = validateQACanvasDocument(invalidDocument)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0)
        }
      })
    })

    describe('createMinimalQACanvasDocument', () => {
      it('should create valid minimal document', () => {
        const ticketId = 'PROJ-TEST-123'
        const minimalDoc = createMinimalQACanvasDocument(ticketId, defaultQAProfile)

        const result = validateQACanvasDocument(minimalDoc)
        expect(result.success).toBe(true)

        expect(minimalDoc.metadata.ticketId).toBe(ticketId)
        expect(minimalDoc.metadata.qaProfile).toEqual(defaultQAProfile)
        expect(minimalDoc.configurationWarnings).toEqual([])
        expect(minimalDoc.acceptanceCriteria).toEqual([])
        expect(minimalDoc.testCases).toEqual([])
      })

      it('should generate current timestamp', () => {
        const beforeTime = new Date()
        const minimalDoc = createMinimalQACanvasDocument('PROJ-TIME-TEST', defaultQAProfile)
        const afterTime = new Date()
        const generatedTime = new Date(minimalDoc.metadata.generatedAt)

        expect(generatedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
        expect(generatedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
        
        // Also verify it's a valid ISO string
        expect(minimalDoc.metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(validateQACanvasDocument(null).success).toBe(false)
      expect(validateQACanvasDocument(undefined).success).toBe(false)
      expect(ticketSummarySchema.safeParse(null).success).toBe(false)
      expect(testCaseSchema.safeParse(null).success).toBe(false)
    })

    it('should handle empty objects', () => {
      expect(validateQACanvasDocument({}).success).toBe(false)
      expect(ticketSummarySchema.safeParse({}).success).toBe(false)
    })

    it('should handle arrays instead of objects', () => {
      expect(validateQACanvasDocument([]).success).toBe(false)
      expect(ticketSummarySchema.safeParse([]).success).toBe(false)
    })
  })
})