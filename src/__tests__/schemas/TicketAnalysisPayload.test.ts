/**
 * Comprehensive tests for TicketAnalysisPayload schema
 */

import { describe, test, expect } from 'vitest';
import { 
  ticketAnalysisPayloadSchema,
  validateTicketAnalysisPayload
} from '../../lib/schemas/TicketAnalysisPayload';
import { defaultQAProfile } from '../../lib/schemas/QAProfile';

describe('TicketAnalysisPayload Schema', () => {
  // Test data
  const validJiraTicket = {
    issueKey: 'TEST-123',
    summary: 'Test ticket',
    description: 'Test description',
    status: 'Done',
    priority: 'Priority: Normal',
    issueType: 'Bug',
    assignee: 'Test User',
    reporter: 'Test Reporter',
    comments: [
      {
        author: 'John Doe',
        body: 'This is a comment',
        created: '2025-07-16T12:00:00Z',
        updated: '2025-07-16T12:01:00Z',
        images: [],
        links: []
      }
    ],
    attachments: [],
    components: ['Frontend', 'API'],
    customFields: {
      acceptanceCriteria: 'User should be able to reset password',
      storyPoints: '5'
    },
    scrapedAt: new Date().toISOString()
  };

  const validQAProfile = defaultQAProfile;

  const validPayload = {
    qaProfile: validQAProfile,
    ticketJson: validJiraTicket
  };

  test('should validate a complete valid TicketAnalysisPayload', () => {
    const result = ticketAnalysisPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qaProfile).toBeDefined();
      expect(result.data.ticketJson).toBeDefined();
      expect(result.data.ticketJson.issueKey).toBe('TEST-123');
    }
  });

  test('should validate using helper function', () => {
    const result = validateTicketAnalysisPayload(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qaProfile).toBeDefined();
      expect(result.data.ticketJson).toBeDefined();
      expect(result.data.ticketJson.issueKey).toBe('TEST-123');
    }
  });

  test('should reject payload with invalid QA profile', () => {
    const invalidPayload = {
      qaProfile: {
        // Missing required fields
        testCaseFormat: 'invalid-format' // Invalid enum value
      },
      ticketJson: validJiraTicket
    };

    const result = ticketAnalysisPayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      
      // Check specific validation errors
      const qaProfileIssue = result.error.issues.find(issue => 
        issue.path.includes('qaProfile'));
      
      expect(qaProfileIssue).toBeDefined();
    }
  });

  test('should reject payload with invalid ticket JSON', () => {
    const invalidPayload = {
      qaProfile: validQAProfile,
      ticketJson: {
        // Missing required fields
        summary: 'Test ticket',
        // Missing description
        status: 'Done'
      }
    };

    const result = ticketAnalysisPayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      
      // Check specific validation errors
      const ticketJsonIssue = result.error.issues.find(issue => 
        issue.path.includes('ticketJson'));
      
      expect(ticketJsonIssue).toBeDefined();
    }
  });

  test('should reject payload with missing required fields', () => {
    // Missing qaProfile
    const missingQAProfile = {
      ticketJson: validJiraTicket
    };

    const missingQAProfileResult = ticketAnalysisPayloadSchema.safeParse(missingQAProfile);
    expect(missingQAProfileResult.success).toBe(false);
    if (!missingQAProfileResult.success) {
      expect(missingQAProfileResult.error.issues.length).toBeGreaterThan(0);
    }

    // Missing ticketJson
    const missingTicketJson = {
      qaProfile: validQAProfile
    };

    const missingTicketJsonResult = ticketAnalysisPayloadSchema.safeParse(missingTicketJson);
    expect(missingTicketJsonResult.success).toBe(false);
    if (!missingTicketJsonResult.success) {
      expect(missingTicketJsonResult.error.issues.length).toBeGreaterThan(0);
    }
  });

  test('should validate payload with minimal valid data', () => {
    const minimalJiraTicket = {
      issueKey: 'TEST-123',
      summary: 'Test ticket',
      description: 'Test description',
      status: 'Done',
      priority: 'Priority: Normal',
      issueType: 'Bug',
      reporter: 'Test Reporter',
      customFields: {},
      scrapedAt: new Date().toISOString()
    };

    const minimalQAProfile = {
      qaCategories: {
        functional: true,
        ui: false,
        ux: false,
        api: false,
        security: false,
        performance: false,
        accessibility: false,
        mobile: false,
        negative: false,
        database: false
      },
      testCaseFormat: 'steps' as const,
      autoRefresh: true,
      includeComments: true,
      includeImages: true,
      operationMode: 'offline' as const,
      showNotifications: true
    };

    const minimalPayload = {
      qaProfile: minimalQAProfile,
      ticketJson: minimalJiraTicket
    };

    const result = ticketAnalysisPayloadSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qaProfile.qaCategories).toEqual(minimalQAProfile.qaCategories);
      expect(result.data.ticketJson.issueKey).toBe(minimalJiraTicket.issueKey);
    }
  });

  test('should reject non-object payloads', () => {
    const invalidPayloads = [
      null,
      undefined,
      'string',
      123,
      true,
      [],
      () => {}
    ];

    invalidPayloads.forEach(payload => {
      const result = ticketAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  test('should handle additional properties gracefully', () => {
    const payloadWithExtra = {
      ...validPayload,
      extraProperty: 'should be ignored',
      metadata: {
        clientVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
    };

    const result = ticketAnalysisPayloadSchema.safeParse(payloadWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      // Extra properties should be stripped out by Zod
      expect(result.data.qaProfile).toBeDefined();
      expect(result.data.ticketJson).toBeDefined();
      // Verify that only expected properties exist
      expect(Object.keys(result.data)).toEqual(['qaProfile', 'ticketJson']);
      // Verify the extra properties are not in the parsed result
      expect('extraProperty' in result.data).toBe(false);
      expect('metadata' in result.data).toBe(false);
    }
  });
});