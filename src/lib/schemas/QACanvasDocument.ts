import { z } from 'zod'
import { qaProfileSchema } from './QAProfile'

/**
 * Schema for ticket summary section
 * Contains simplified explanation of the ticket
 */
export const ticketSummarySchema = z.object({
  problem: z.string().describe('Clear explanation of what problem exists or what need is being addressed'),
  solution: z.string().describe('Description of what will be built or fixed to address the problem'),
  context: z.string().describe('How this functionality fits into the broader system and normal operation')
})

/**
 * Schema for configuration warnings
 * Generated when there are conflicts between ticket requirements and QA settings
 */
export const configurationWarningSchema = z.object({
  type: z.enum(['category_mismatch', 'missing_capability', 'recommendation']).describe('Type of warning'),
  title: z.string().describe('Warning title for display'),
  message: z.string().describe('Detailed warning message explaining the issue'),
  recommendation: z.string().describe('Specific recommendation to resolve the warning'),
  severity: z.enum(['high', 'medium', 'low']).default('medium').describe('Warning severity level')
})

/**
 * Schema for individual acceptance criteria
 */
export const acceptanceCriterionSchema = z.object({
  id: z.string().describe('Unique identifier for the criterion'),
  title: z.string().describe('Brief title describing the criterion'),
  description: z.string().describe('Detailed description of what must be satisfied'),
  priority: z.enum(['must', 'should', 'could']).default('must').describe('MoSCoW priority level'),
  category: z.enum(['functional', 'ui', 'ux', 'performance', 'security', 'accessibility', 'api', 'database']).describe('Category of the acceptance criterion'),
  testable: z.boolean().default(true).describe('Whether this criterion can be directly tested')
})

/**
 * Schema for test steps (used in steps and table formats)
 */
export const testStepSchema = z.object({
  stepNumber: z.number().describe('Sequential step number'),
  action: z.string().describe('Action to perform'),
  expectedResult: z.string().describe('Expected outcome of the action'),
  notes: z.string().optional().describe('Additional notes or context for the step')
})

/**
 * Schema for Gherkin-style test cases
 */
export const gherkinTestCaseSchema = z.object({
  scenario: z.string().describe('Scenario name/title'),
  given: z.array(z.string()).describe('Given conditions (preconditions)'),
  when: z.array(z.string()).describe('When actions (actions taken)'),
  then: z.array(z.string()).describe('Then assertions (expected outcomes)'),
  tags: z.array(z.string()).default([]).describe('Tags for categorization (@smoke, @regression, etc.)')
})

/**
 * Schema for step-by-step test cases
 */
export const stepsTestCaseSchema = z.object({
  title: z.string().describe('Test case title'),
  objective: z.string().describe('What this test case aims to verify'),
  preconditions: z.array(z.string()).default([]).describe('Prerequisites before executing the test'),
  steps: z.array(testStepSchema).describe('Sequential test steps'),
  postconditions: z.array(z.string()).default([]).describe('Cleanup or verification after test completion')
})

/**
 * Schema for table-format test cases
 */
export const tableTestCaseSchema = z.object({
  title: z.string().describe('Test case title'),
  description: z.string().describe('Brief description of what is being tested'),
  testData: z.array(z.record(z.string(), z.string())).describe('Array of test data rows with key-value pairs'),
  expectedOutcome: z.string().describe('Overall expected outcome for the test case'),
  notes: z.string().optional().describe('Additional notes about the test case')
})

/**
 * Union schema for different test case formats
 */
export const testCaseSchema = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('gherkin'),
    id: z.string().describe('Unique test case identifier'),
    category: z.string().describe('Test category (functional, ui, negative, etc.)'),
    priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Test case priority'),
    estimatedTime: z.string().optional().describe('Estimated execution time'),
    testCase: gherkinTestCaseSchema
  }),
  z.object({
    format: z.literal('steps'),
    id: z.string().describe('Unique test case identifier'),
    category: z.string().describe('Test category (functional, ui, negative, etc.)'),
    priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Test case priority'),
    estimatedTime: z.string().optional().describe('Estimated execution time'),
    testCase: stepsTestCaseSchema
  }),
  z.object({
    format: z.literal('table'),
    id: z.string().describe('Unique test case identifier'),
    category: z.string().describe('Test category (functional, ui, negative, etc.)'),
    priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Test case priority'),
    estimatedTime: z.string().optional().describe('Estimated execution time'),
    testCase: tableTestCaseSchema
  })
])

/**
 * Schema for document metadata
 */
export const documentMetadataSchema = z.object({
  generatedAt: z.string().describe('ISO timestamp when document was generated'),
  qaProfile: qaProfileSchema.describe('QA profile used for generation'),
  ticketId: z.string().describe('Jira ticket ID/key'),
  documentVersion: z.string().default('1.0').describe('Document version for tracking changes'),
  aiModel: z.string().optional().describe('AI model used for generation (e.g., "gpt-4o")'),
  generationTime: z.number().optional().describe('Time taken to generate document in milliseconds'),
  wordCount: z.number().optional().describe('Approximate word count of generated content')
})

/**
 * Complete QA Canvas Document schema
 * Represents the full structure of AI-generated QA documentation
 */
export const qaCanvasDocumentSchema = z.object({
  // Core content sections
  ticketSummary: ticketSummarySchema.describe('Simplified explanation of the ticket in plain language'),
  configurationWarnings: z.array(configurationWarningSchema).default([]).describe('Warnings about configuration conflicts'),
  acceptanceCriteria: z.array(acceptanceCriterionSchema).describe('List of acceptance criteria derived from the ticket'),
  testCases: z.array(testCaseSchema).describe('Generated test cases in the specified format'),
  
  // Document metadata
  metadata: documentMetadataSchema.describe('Metadata about document generation and configuration')
})

// Type exports for TypeScript usage
export type TicketSummary = z.infer<typeof ticketSummarySchema>
export type ConfigurationWarning = z.infer<typeof configurationWarningSchema>
export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>
export type TestStep = z.infer<typeof testStepSchema>
export type GherkinTestCase = z.infer<typeof gherkinTestCaseSchema>
export type StepsTestCase = z.infer<typeof stepsTestCaseSchema>
export type TableTestCase = z.infer<typeof tableTestCaseSchema>
export type TestCase = z.infer<typeof testCaseSchema>
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>
export type QACanvasDocument = z.infer<typeof qaCanvasDocumentSchema>

/**
 * Helper function to validate QA Canvas Document
 * Returns validation result with detailed error information
 */
export function validateQACanvasDocument(data: unknown) {
  return qaCanvasDocumentSchema.safeParse(data)
}

/**
 * Helper function to create a minimal QA Canvas Document
 * Useful for testing and initial document creation
 */
export function createMinimalQACanvasDocument(
  ticketId: string,
  qaProfile: z.infer<typeof qaProfileSchema>
): QACanvasDocument {
  return {
    ticketSummary: {
      problem: '',
      solution: '',
      context: ''
    },
    configurationWarnings: [],
    acceptanceCriteria: [],
    testCases: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      qaProfile,
      ticketId,
      documentVersion: '1.0'
    }
  }
}