/**
 * Test for schemas index exports
 */

import { describe, test, expect } from 'vitest';
import * as schemas from '../../lib/schemas';

describe('Schema Index Exports', () => {
  test('should export all schema types and validators', () => {
    // Check QAProfile exports
    expect(schemas.qaProfileSchema).toBeDefined();
    expect(schemas.qaCategoriesSchema).toBeDefined();
    expect(schemas.testCaseFormatSchema).toBeDefined();
    expect(typeof schemas.qaProfileSchema.parse).toBe('function');
    
    // Check JiraTicket exports
    expect(schemas.jiraTicketSchema).toBeDefined();
    expect(schemas.jiraCommentSchema).toBeDefined();
    expect(schemas.jiraAttachmentSchema).toBeDefined();
    expect(typeof schemas.jiraTicketSchema.parse).toBe('function');
    
    // Check TicketAnalysisPayload exports
    expect(schemas.ticketAnalysisPayloadSchema).toBeDefined();
    expect(typeof schemas.ticketAnalysisPayloadSchema.parse).toBe('function');
    
    // Check QACanvasDocument exports
    expect(schemas.qaCanvasDocumentSchema).toBeDefined();
    expect(schemas.ticketSummarySchema).toBeDefined();
    expect(schemas.acceptanceCriterionSchema).toBeDefined();
    expect(schemas.testCaseSchema).toBeDefined();
    expect(schemas.configurationWarningSchema).toBeDefined();
    expect(schemas.documentMetadataSchema).toBeDefined();
    expect(typeof schemas.qaCanvasDocumentSchema.parse).toBe('function');
    
    // Check QASuggestion exports
    expect(schemas.qaSuggestionSchema).toBeDefined();
    expect(schemas.qaSuggestionTool).toBeDefined();
    expect(schemas.suggestionTypeSchema).toBeDefined();
    expect(schemas.suggestionPrioritySchema).toBeDefined();
    expect(typeof schemas.qaSuggestionSchema.parse).toBe('function');
  });
  
  test('should export TypeScript types for all schemas', () => {
    // This is a type-level test that ensures types are exported
    // We can't directly test types at runtime, but we can check that the exports exist
    expect(Object.keys(schemas).length).toBeGreaterThan(10);
    
    // Check that type names are exported (indirectly)
    const exportedNames = Object.keys(schemas);
    
    // QAProfile types
    expect(exportedNames).toContain('qaProfileSchema');
    expect(exportedNames).toContain('qaCategoriesSchema');
    expect(exportedNames).toContain('testCaseFormatSchema');
    expect(exportedNames).toContain('defaultQAProfile');
    
    // JiraTicket types
    expect(exportedNames).toContain('jiraTicketSchema');
    expect(exportedNames).toContain('jiraCommentSchema');
    expect(exportedNames).toContain('jiraAttachmentSchema');
    
    // TicketAnalysisPayload types
    expect(exportedNames).toContain('ticketAnalysisPayloadSchema');
    
    // QACanvasDocument types
    expect(exportedNames).toContain('qaCanvasDocumentSchema');
    expect(exportedNames).toContain('ticketSummarySchema');
    expect(exportedNames).toContain('acceptanceCriterionSchema');
    expect(exportedNames).toContain('testCaseSchema');
    expect(exportedNames).toContain('configurationWarningSchema');
    expect(exportedNames).toContain('documentMetadataSchema');
    
    // QASuggestion types
    expect(exportedNames).toContain('qaSuggestionSchema');
    expect(exportedNames).toContain('qaSuggestionTool');
    expect(exportedNames).toContain('suggestionTypeSchema');
    expect(exportedNames).toContain('suggestionPrioritySchema');
  });
  
  test('should provide helper functions for schema validation', () => {
    // Check QASuggestion helper functions
    expect(typeof schemas.validateQASuggestion).toBe('function');
    expect(typeof schemas.validateQASuggestionsResponse).toBe('function');
    expect(typeof schemas.validateGenerateSuggestionsRequest).toBe('function');
    expect(typeof schemas.createQASuggestion).toBe('function');
    
    // Check QACanvasDocument helper functions
    expect(typeof schemas.createMinimalQACanvasDocument).toBe('function');
    expect(typeof schemas.validateQACanvasDocument).toBe('function');
    
    // Test a helper function
    const validSuggestion = {
      id: 'test-123',
      suggestionType: 'edge_case',
      title: 'Test edge case',
      description: 'Add a test case',
      priority: 'high',
      reasoning: 'Important test',
      tags: []
    };
    
    const result = schemas.validateQASuggestion(validSuggestion);
    expect(result.success).toBe(true);
  });
  
  test('should provide default values for schemas', () => {
    // Check default QA profile
    expect(schemas.defaultQAProfile).toBeDefined();
    expect(schemas.defaultQAProfile.qaCategories).toBeDefined();
    expect(schemas.defaultQAProfile.qaCategories.functional).toBe(true);
    expect(schemas.defaultQAProfile.testCaseFormat).toBe('steps');
    
    // Test creating a minimal document
    const minimalDoc = schemas.createMinimalQACanvasDocument('TEST-123', schemas.defaultQAProfile);
    expect(minimalDoc).toBeDefined();
    expect(minimalDoc.metadata.ticketId).toBe('TEST-123');
    expect(minimalDoc.acceptanceCriteria).toEqual([]);
    expect(minimalDoc.testCases).toEqual([]);
  });
  
  test('should validate schema compatibility between modules', () => {
    // Test that QAProfile schema is compatible with TicketAnalysisPayload schema
    const validProfile = schemas.defaultQAProfile;
    
    const ticketPayload = {
      qaProfile: validProfile,
      ticketJson: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        status: 'Done',
        priority: 'Priority: Normal',
        issueType: 'Bug',
        assignee: 'Test User',
        reporter: 'Test Reporter',
        comments: [],
        attachments: [],
        components: [],
        customFields: {},
        scrapedAt: new Date().toISOString()
      }
    };
    
    const result = schemas.ticketAnalysisPayloadSchema.safeParse(ticketPayload);
    expect(result.success).toBe(true);
  });
});