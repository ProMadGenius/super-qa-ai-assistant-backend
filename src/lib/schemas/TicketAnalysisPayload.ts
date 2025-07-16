import { z } from 'zod'
import { qaProfileSchema } from './QAProfile'
import { jiraTicketSchema } from './JiraTicket'

/**
 * Schema for the payload sent to /api/analyze-ticket endpoint
 * Combines QA profile preferences with Jira ticket data
 */
export const ticketAnalysisPayloadSchema = z.object({
  qaProfile: qaProfileSchema.describe('User QA preferences and configuration'),
  ticketJson: jiraTicketSchema.describe('Complete Jira ticket data scraped from the page')
})

/**
 * Validation schema for the analyze-ticket API endpoint
 * Includes additional validation rules for the API context
 */
export const analyzeTicketRequestSchema = ticketAnalysisPayloadSchema.extend({
  // Optional metadata for tracking and debugging
  requestId: z.string().optional().describe('Optional request ID for tracking'),
  clientVersion: z.string().optional().describe('Chrome extension version'),
  userAgent: z.string().optional().describe('Browser user agent string')
})

// Type exports for TypeScript usage
export type TicketAnalysisPayload = z.infer<typeof ticketAnalysisPayloadSchema>
export type AnalyzeTicketRequest = z.infer<typeof analyzeTicketRequestSchema>

/**
 * Helper function to validate ticket analysis payload
 * Returns validation result with detailed error information
 */
export function validateTicketAnalysisPayload(data: unknown) {
  return ticketAnalysisPayloadSchema.safeParse(data)
}

/**
 * Helper function to validate analyze-ticket API request
 * Returns validation result with detailed error information
 */
export function validateAnalyzeTicketRequest(data: unknown) {
  return analyzeTicketRequestSchema.safeParse(data)
}