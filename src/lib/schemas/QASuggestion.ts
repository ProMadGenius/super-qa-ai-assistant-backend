import { z } from 'zod'
import { tool } from 'ai'

/**
 * Schema for QA suggestion types
 * Categorizes different kinds of suggestions the AI can make
 */
export const suggestionTypeSchema = z.enum([
  'edge_case',
  'ui_verification', 
  'functional_test',
  'clarification_question',
  'negative_test',
  'performance_test',
  'security_test',
  'accessibility_test',
  'integration_test',
  'data_validation'
], {
  description: 'Type of QA suggestion being made'
})

/**
 * Schema for suggestion priority levels
 */
export const suggestionPrioritySchema = z.enum(['high', 'medium', 'low'], {
  description: 'Priority level of the suggestion'
})

/**
 * Schema for individual QA suggestions
 */
export const qaSuggestionSchema = z.object({
  id: z.string().describe('Unique identifier for the suggestion'),
  suggestionType: suggestionTypeSchema.describe('Category of the QA suggestion'),
  title: z.string().describe('Brief title summarizing the suggestion'),
  description: z.string().describe('Detailed text of the suggestion for the user'),
  targetSection: z.string().optional().describe('Specific section of the document this suggestion applies to (e.g., "Acceptance Criteria", "Test Cases")'),
  priority: suggestionPrioritySchema.default('medium').describe('Priority level of this suggestion'),
  reasoning: z.string().describe('Explanation of why this suggestion is important or relevant'),
  implementationHint: z.string().optional().describe('Hint on how to implement or address this suggestion'),
  relatedRequirements: z.array(z.string()).default([]).describe('List of requirement IDs this suggestion relates to'),
  estimatedEffort: z.enum(['low', 'medium', 'high']).optional().describe('Estimated effort to implement this suggestion'),
  tags: z.array(z.string()).default([]).describe('Tags for categorization and filtering')
})

/**
 * Schema for the complete suggestions response
 */
export const qaSuggestionsResponseSchema = z.object({
  suggestions: z.array(qaSuggestionSchema).describe('Array of QA suggestions'),
  totalCount: z.number().describe('Total number of suggestions generated'),
  generatedAt: z.string().describe('ISO timestamp when suggestions were generated'),
  contextSummary: z.string().describe('Brief summary of the document context used for generating suggestions')
})

/**
 * Schema for suggestion generation request
 */
export const generateSuggestionsRequestSchema = z.object({
  currentDocument: z.string().describe('JSON string of the current QACanvasDocument'),
  maxSuggestions: z.number().min(1).max(10).default(3).describe('Maximum number of suggestions to generate'),
  focusAreas: z.array(suggestionTypeSchema).optional().describe('Specific types of suggestions to focus on'),
  excludeTypes: z.array(suggestionTypeSchema).default([]).describe('Types of suggestions to exclude'),
  requestId: z.string().optional().describe('Optional request ID for tracking')
})

// Type exports for TypeScript usage
export type SuggestionType = z.infer<typeof suggestionTypeSchema>
export type SuggestionPriority = z.infer<typeof suggestionPrioritySchema>
export type QASuggestion = z.infer<typeof qaSuggestionSchema>
export type QASuggestionsResponse = z.infer<typeof qaSuggestionsResponseSchema>
export type GenerateSuggestionsRequest = z.infer<typeof generateSuggestionsRequestSchema>

/**
 * AI Tool definition for generating QA suggestions
 * This tool will be used with Vercel AI SDK's generateText function
 */
export const qaSuggestionTool = tool({
  description: 'Generate a single, actionable QA suggestion to improve the test plan and documentation coverage.',
  parameters: z.object({
    suggestionType: suggestionTypeSchema.describe('The category of the QA suggestion'),
    title: z.string().describe('Brief, actionable title for the suggestion'),
    description: z.string().describe('Detailed explanation of what should be done and why'),
    targetSection: z.string().describe('Specific document section this applies to'),
    priority: suggestionPrioritySchema.describe('How important this suggestion is'),
    reasoning: z.string().describe('Why this suggestion is valuable for QA coverage')
  }),
  // No execute function needed - we just want the AI to generate the parameters
})

/**
 * Helper function to validate QA suggestion
 */
export function validateQASuggestion(data: unknown) {
  return qaSuggestionSchema.safeParse(data)
}

/**
 * Helper function to validate suggestions response
 */
export function validateQASuggestionsResponse(data: unknown) {
  return qaSuggestionsResponseSchema.safeParse(data)
}

/**
 * Helper function to validate generate suggestions request
 */
export function validateGenerateSuggestionsRequest(data: unknown) {
  return generateSuggestionsRequestSchema.safeParse(data)
}

/**
 * Helper function to create a QA suggestion with auto-generated ID
 */
export function createQASuggestion(
  suggestionData: Omit<QASuggestion, 'id'>
): QASuggestion {
  return {
    id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...suggestionData
  }
}