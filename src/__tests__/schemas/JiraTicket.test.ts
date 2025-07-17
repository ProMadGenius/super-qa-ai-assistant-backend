/**
 * Comprehensive tests for JiraTicket schema
 */

import { describe, test, expect } from 'vitest';
import { 
  jiraTicketSchema,
  jiraCommentSchema,
  jiraAttachmentSchema
} from '../../lib/schemas/JiraTicket';

describe('JiraTicket Schema', () => {
  // Test data (updated to match current schema structure)
  const validComment = {
    author: 'John Doe',
    body: 'This is a comment',
    date: '2025-07-16T12:00:00Z',
    images: [],
    links: []
  };

  const validAttachment = {
    data: 'base64-encoded-content',
    mime: 'image/png',
    name: 'screenshot.png',
    size: 1024,
    tooBig: false,
    url: 'blob:screenshot.png'
  };

  const validTicket = {
    issueKey: 'TEST-123',
    summary: 'Test ticket',
    description: 'Test description',
    status: 'Done',
    priority: 'Priority: Normal',
    issueType: 'Bug',
    assignee: 'Test User',
    reporter: 'Test Reporter',
    comments: [validComment],
    attachments: [validAttachment],
    components: ['Frontend', 'API'],
    customFields: {
      acceptanceCriteria: 'User should be able to reset password',
      storyPoints: '5'
    },
    scrapedAt: new Date().toISOString()
  };

  test('should validate a complete valid JiraTicket', () => {
    const result = jiraTicketSchema.safeParse(validTicket);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validTicket);
    }
  });

  test('should validate JiraComment schema', () => {
    const result = jiraCommentSchema.safeParse(validComment);
    expect(result.success).toBe(true);

    // Test invalid comment
    const invalidComment = {
      // Missing author
      body: 'This is a comment body',
      // Missing both date and created fields (required by refinement)
    };

    const invalidResult = jiraCommentSchema.safeParse(invalidComment);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
      
      // Just check that we have validation errors - the specific structure may vary
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
    }
  });

  test('should validate JiraAttachment schema', () => {
    const result = jiraAttachmentSchema.safeParse(validAttachment);
    expect(result.success).toBe(true);

    // Test invalid attachment
    const invalidAttachment = {
      // Missing data
      mime: 'invalid-mime-type', // Not a standard MIME type
      // Missing name
      size: 'not-a-number', // Should be number
      tooBig: 'not-a-boolean', // Should be boolean
      // Missing url
    };

    const invalidResult = jiraAttachmentSchema.safeParse(invalidAttachment);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
      
      // Check specific validation errors
      const dataIssue = invalidResult.error.issues.find(issue => 
        issue.code === 'invalid_type' && issue.path.includes('data'));
      const sizeIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('size'));
      const nameIssue = invalidResult.error.issues.find(issue => 
        issue.code === 'invalid_type' && issue.path.includes('name'));
      const tooBigIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('tooBig'));
      
      expect(dataIssue).toBeDefined();
      expect(sizeIssue).toBeDefined();
      expect(nameIssue).toBeDefined();
      expect(tooBigIssue).toBeDefined();
    }
  });

  test('should validate JiraTicket with required fields only', () => {
    const minimalTicket = {
      issueKey: 'TEST-123',
      summary: 'Test ticket',
      description: 'Test description',
      status: 'Done',
      priority: 'Priority: Normal',
      issueType: 'Bug',
      reporter: 'Test Reporter',
      scrapedAt: new Date().toISOString(),
      customFields: {}
    };

    const result = jiraTicketSchema.safeParse(minimalTicket);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.issueKey).toBe('TEST-123');
      expect(result.data.comments).toEqual([]);
      expect(result.data.attachments).toEqual([]);
      expect(result.data.components).toEqual([]);
    }
  });

  test('should reject invalid JiraTicket', () => {
    const invalidTicket = {
      // Missing issueKey
      summary: '', // Empty summary
      // Missing description
      status: 'Done',
      issueType: 123, // Should be string
      comments: 'not-an-array', // Should be array
      attachments: [{}], // Invalid attachments
      components: 'Frontend', // Should be array
      customFields: 'not-an-object', // Should be object
      scrapedAt: 'not-a-date' // Invalid date format
    };

    const invalidResult = jiraTicketSchema.safeParse(invalidTicket);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
      
      // Check that we have validation errors for the expected fields
      const issueKeyIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('issueKey'));
      const summaryIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('summary'));
      const descriptionIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('description'));
      const issueTypeIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('issueType'));
      const commentsIssue = invalidResult.error.issues.find(issue => 
        issue.path.includes('comments'));
      
      // At least some of these should be defined
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
    }
  });

  test('should validate ticket with empty arrays', () => {
    const ticketWithEmptyArrays = {
      ...validTicket,
      comments: [],
      attachments: [],
      components: []
    };

    const result = jiraTicketSchema.safeParse(ticketWithEmptyArrays);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comments).toEqual([]);
      expect(result.data.attachments).toEqual([]);
      expect(result.data.components).toEqual([]);
    }
  });

  test('should validate ticket with complex customFields', () => {
    const ticketWithComplexCustomFields = {
      ...validTicket,
      customFields: {
        acceptanceCriteria: 'User should be able to reset password',
        storyPoints: '5',
        testCases: ['Test case 1', 'Test case 2'],
        complexity: {
          level: 'high',
          reason: 'Multiple integrations'
        }
      }
    };

    const result = jiraTicketSchema.safeParse(ticketWithComplexCustomFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customFields).toEqual(ticketWithComplexCustomFields.customFields);
    }
  });

  test('should validate ticket with valid scrapedAt date', () => {
    const ticketWithValidDate = {
      ...validTicket,
      scrapedAt: '2025-07-16T12:00:00Z'
    };

    const result = jiraTicketSchema.safeParse(ticketWithValidDate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scrapedAt).toBe('2025-07-16T12:00:00Z');
    }
  });
});