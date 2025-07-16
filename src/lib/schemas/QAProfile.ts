import { z } from 'zod'

/**
 * Schema for QA Categories configuration
 * Defines which types of testing the user wants to focus on
 */
export const qaCategoriesSchema = z.object({
  functional: z.boolean().describe('Functional testing - core feature behavior'),
  ux: z.boolean().describe('User experience testing - usability and user flows'),
  ui: z.boolean().describe('User interface testing - visual elements and interactions'),
  negative: z.boolean().describe('Negative testing - error handling and edge cases'),
  api: z.boolean().describe('API testing - endpoints, data validation, integration'),
  database: z.boolean().describe('Database testing - data integrity and persistence'),
  performance: z.boolean().describe('Performance testing - load, speed, resource usage'),
  security: z.boolean().describe('Security testing - authentication, authorization, vulnerabilities'),
  mobile: z.boolean().describe('Mobile testing - responsive design and mobile-specific features'),
  accessibility: z.boolean().describe('Accessibility testing - WCAG compliance and inclusive design')
})

/**
 * Schema for test case format preferences
 */
export const testCaseFormatSchema = z.enum(['gherkin', 'steps', 'table'], {
  description: 'Format for generated test cases'
})

/**
 * Complete QA Profile schema
 * Contains user preferences for QA analysis and test generation
 * Updated to match real Chrome extension data structure
 */
export const qaProfileSchema = z.object({
  // Core QA settings
  qaCategories: qaCategoriesSchema.describe('Active QA testing categories'),
  testCaseFormat: testCaseFormatSchema.describe('Preferred format for test case generation'),
  
  // Extension behavior settings
  autoRefresh: z.boolean().describe('Whether to auto-refresh ticket data'),
  includeComments: z.boolean().describe('Whether to include ticket comments in analysis'),
  includeImages: z.boolean().describe('Whether to include images from comments and attachments'),
  operationMode: z.enum(['online', 'offline']).describe('Extension operation mode'),
  showNotifications: z.boolean().describe('Whether to show browser notifications')
})

// Type exports for TypeScript usage
export type QACategories = z.infer<typeof qaCategoriesSchema>
export type TestCaseFormat = z.infer<typeof testCaseFormatSchema>
export type QAProfile = z.infer<typeof qaProfileSchema>

// Default QA Profile for new users
export const defaultQAProfile: QAProfile = {
  qaCategories: {
    functional: true,
    ux: true,
    ui: true,
    negative: true,
    api: false,
    database: false,
    performance: false,
    security: false,
    mobile: true,
    accessibility: true
  },
  testCaseFormat: 'steps',
  autoRefresh: true,
  includeComments: true,
  includeImages: true,
  operationMode: 'offline',
  showNotifications: true
}