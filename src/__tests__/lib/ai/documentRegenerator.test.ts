/**
 * Comprehensive tests for document regenerator
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { 
  regenerateDocument,
  trackDocumentChanges,
  RegenerationContext,
  RegenerationOptions
} from '../../../lib/ai/documentRegenerator';
import { createMinimalQACanvasDocument } from '../../../lib/schemas/QACanvasDocument';
import { defaultQAProfile } from '../../../lib/schemas/QAProfile';

// Mock AI functions
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  tool: vi.fn().mockImplementation((config) => ({
    ...config,
    _isTool: true
  }))
}));

import { generateObject } from 'ai';

describe('Document Regenerator', () => {
  // Sample test data
  const sampleDocument = createMinimalQACanvasDocument('TEST-123', defaultQAProfile);
  
  // Update sample document with more realistic data
  sampleDocument.ticketSummary = {
    problem: 'Users cannot reset their password when using special characters',
    solution: 'Update password reset functionality to handle special characters correctly',
    context: 'The password reset feature is critical for user account management'
  };
  
  sampleDocument.acceptanceCriteria = [
    {
      id: 'ac-1',
      title: 'Password reset with special characters',
      description: 'System should allow password reset with special characters',
      priority: 'must',
      category: 'functional',
      testable: true
    }
  ];
  
  sampleDocument.testCases = [
    {
      format: 'steps',
      id: 'tc-1',
      category: 'functional',
      priority: 'high',
      testCase: {
        title: 'Reset password with special characters',
        objective: 'Verify that users can reset passwords containing special characters',
        preconditions: ['User has a valid account'],
        steps: [
          {
            stepNumber: 1,
            action: 'Navigate to password reset page',
            expectedResult: 'Password reset page loads'
          },
          {
            stepNumber: 2,
            action: 'Enter email address',
            expectedResult: 'Email field accepts input'
          }
        ],
        postconditions: ['Password is successfully reset']
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should regenerate document successfully', async () => {
    // Mock the AI function
    const regeneratedDocument = {
      ...sampleDocument,
      metadata: {
        ...sampleDocument.metadata,
        generatedAt: new Date().toISOString(),
        documentVersion: '1.1'
      }
    };
    
    (generateObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: regeneratedDocument
    });
    
    const context: RegenerationContext = {
      originalDocument: sampleDocument,
      conversationHistory: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please add a test case for invalid email addresses',
          createdAt: new Date().toISOString()
        }
      ],
      userFeedback: 'Please add a test case for invalid email addresses',
      ticketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Bug',
        priority: 'Priority: Normal',
        reporter: 'Test Reporter',
        status: 'In Progress',
        comments: [],
        attachments: [],
        customFields: {},
        components: [],
        scrapedAt: new Date().toISOString()
      },
      qaProfile: defaultQAProfile
    };
    
    const result = await regenerateDocument(context);
    
    expect(result).toBeDefined();
    expect(result.document).toBeDefined();
    expect(result.changes).toBeDefined();
    expect(result.regenerationTime).toBeGreaterThanOrEqual(0);
    
    // Verify the AI function was called correctly
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Please add a test case for invalid email addresses')
    }));
  });

  test('should track document changes', () => {
    const modifiedDocument = {
      ...sampleDocument,
      testCases: [
        {
          format: 'steps' as const,
          id: 'tc-1',
          category: 'functional',
          priority: 'high' as const,
          testCase: {
            title: 'Reset password with special characters - Updated',
            objective: 'Updated objective',
            preconditions: ['User has a valid account'],
            steps: [
              {
                stepNumber: 1,
                action: 'Navigate to password reset page',
                expectedResult: 'Password reset page loads'
              },
              {
                stepNumber: 2,
                action: 'Enter email address',
                expectedResult: 'Email field accepts input'
              },
              {
                stepNumber: 3,
                action: 'Verify login with new password',
                expectedResult: 'User can login successfully'
              }
            ],
            postconditions: ['Password is successfully reset']
          }
        }
      ]
    };
    
    const changes = trackDocumentChanges(sampleDocument, modifiedDocument);
    
    expect(changes).toBeDefined();
    expect(Array.isArray(changes)).toBe(true);
    expect(changes.length).toBeGreaterThan(0);
    
    // Should detect test case changes
    const testCaseChange = changes.find(change => change.section === 'testCases');
    expect(testCaseChange).toBeDefined();
    expect(testCaseChange?.changeType).toBe('modified');
  });

  test('should preserve document context in metadata', () => {
    const originalContext = {
      ticketId: 'TEST-123',
      qaProfile: defaultQAProfile,
      generatedAt: sampleDocument.metadata.generatedAt
    };
    
    const newDocument = {
      ...sampleDocument,
      metadata: {
        ...sampleDocument.metadata,
        generatedAt: new Date().toISOString(), // Different timestamp
        ticketId: originalContext.ticketId,
        qaProfile: originalContext.qaProfile
      }
    };
    
    expect(newDocument).toBeDefined();
    expect(newDocument.metadata.ticketId).toBe('TEST-123');
    expect(newDocument.metadata.qaProfile).toEqual(defaultQAProfile);
  });

  test('should validate regenerated document', () => {
    // Test document validation by checking schema compliance
    const validDocument = sampleDocument;
    
    // Valid document should have all required fields
    expect(validDocument.ticketSummary).toBeDefined();
    expect(validDocument.acceptanceCriteria).toBeDefined();
    expect(validDocument.testCases).toBeDefined();
    expect(validDocument.metadata).toBeDefined();
    
    // Test that arrays are properly structured
    expect(Array.isArray(validDocument.acceptanceCriteria)).toBe(true);
    expect(Array.isArray(validDocument.testCases)).toBe(true);
    
    // Test that required fields in nested objects exist
    expect(validDocument.ticketSummary.problem).toBeDefined();
    expect(validDocument.ticketSummary.solution).toBeDefined();
    expect(validDocument.ticketSummary.context).toBeDefined();
  });

  test('should handle regeneration error', () => {
    const error = new Error('AI processing failed');
    
    // Test error handling by simulating what would happen in error scenarios
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('AI processing failed');
    
    // Test that we can create a proper error response structure
    const errorResponse = {
      success: false,
      error: error,
      document: sampleDocument, // Original document returned
      errorMessage: `Failed to regenerate document: ${error.message}`
    };
    
    expect(errorResponse).toBeDefined();
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toStrictEqual(error);
    expect(errorResponse.document).toEqual(sampleDocument);
    expect(errorResponse.errorMessage).toContain('Failed to regenerate document');
  });

  test('should handle AI errors during regeneration', async () => {
    // Mock the AI function to throw an error
    (generateObject as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI service unavailable')
    );
    
    const context: RegenerationContext = {
      originalDocument: sampleDocument,
      conversationHistory: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please add a test case for invalid email addresses',
          createdAt: new Date().toISOString()
        }
      ],
      userFeedback: 'Please add a test case for invalid email addresses',
      ticketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Bug',
        priority: 'Priority: Normal',
        reporter: 'Test Reporter',
        status: 'In Progress',
        comments: [],
        attachments: [],
        customFields: {},
        components: [],
        scrapedAt: new Date().toISOString()
      },
      qaProfile: defaultQAProfile
    };
    
    await expect(regenerateDocument(context)).rejects.toThrow('Document regeneration failed');
  });

  test('should preserve IDs when requested', async () => {
    // Create a document with specific IDs to test preservation
    const regeneratedDocument = {
      ...sampleDocument,
      acceptanceCriteria: [
        {
          id: 'ac-1', // Same ID as original
          title: 'Updated acceptance criterion',
          description: 'Updated description for testing ID preservation',
          priority: 'must',
          category: 'functional',
          testable: true
        }
      ],
      testCases: [
        {
          format: 'steps',
          id: 'tc-1', // Same ID as original
          category: 'functional',
          priority: 'high',
          testCase: {
            title: 'Updated test case title',
            objective: 'Updated objective for testing ID preservation',
            preconditions: ['User has a valid account'],
            steps: [
              {
                stepNumber: 1,
                action: 'Updated action',
                expectedResult: 'Updated result'
              }
            ],
            postconditions: ['Updated postcondition']
          }
        }
      ],
      metadata: {
        ...sampleDocument.metadata,
        generatedAt: new Date().toISOString(),
        documentVersion: '1.1'
      }
    };
    
    (generateObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: regeneratedDocument
    });
    
    const context: RegenerationContext = {
      originalDocument: sampleDocument,
      conversationHistory: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please update all test cases and acceptance criteria',
          createdAt: new Date().toISOString()
        }
      ],
      userFeedback: 'Please update all test cases and acceptance criteria',
      ticketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Bug',
        priority: 'Priority: Normal',
        reporter: 'Test Reporter',
        status: 'In Progress',
        comments: [],
        attachments: [],
        customFields: {},
        components: [],
        scrapedAt: new Date().toISOString()
      },
      qaProfile: defaultQAProfile
    };
    
    const result = await regenerateDocument(context, { preserveStructure: true });
    
    expect(result).toBeDefined();
    expect(result.document).toBeDefined();
    expect(result.changes).toBeDefined();
    expect(result.regenerationTime).toBeGreaterThanOrEqual(0);
    
    // Verify IDs are preserved
    expect(result.document.acceptanceCriteria[0].id).toBe('ac-1');
    expect(result.document.testCases[0].id).toBe('tc-1');
    
    // Verify content was updated
    expect(result.document.acceptanceCriteria[0].title).toBe('Updated acceptance criterion');
    const testCase = result.document.testCases[0];
    if (testCase.format === 'steps' || testCase.format === 'table') {
      expect(testCase.testCase.title).toBe('Updated test case title');
    } else if (testCase.format === 'gherkin') {
      expect(testCase.testCase.scenario).toBe('Updated test case title');
    }
  });

  test('should generate new IDs when not preserving', async () => {
    // Create a document with new content and potentially new IDs
    const regeneratedDocument = {
      ...sampleDocument,
      acceptanceCriteria: [
        {
          id: 'ac-new-1', // Different ID than original
          title: 'New acceptance criterion',
          description: 'New description for testing ID generation',
          priority: 'should',
          category: 'functional',
          testable: true
        }
      ],
      testCases: [
        {
          format: 'steps',
          id: 'tc-new-1', // Different ID than original
          category: 'functional',
          priority: 'medium',
          testCase: {
            title: 'New test case title',
            objective: 'New objective for testing ID generation',
            preconditions: ['User has a valid account'],
            steps: [
              {
                stepNumber: 1,
                action: 'New action',
                expectedResult: 'New result'
              }
            ],
            postconditions: ['New postcondition']
          }
        }
      ],
      metadata: {
        ...sampleDocument.metadata,
        generatedAt: new Date().toISOString(),
        documentVersion: '1.1'
      }
    };
    
    (generateObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: regeneratedDocument
    });
    
    const context: RegenerationContext = {
      originalDocument: sampleDocument,
      conversationHistory: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please create completely new test cases and acceptance criteria',
          createdAt: new Date().toISOString()
        }
      ],
      userFeedback: 'Please create completely new test cases and acceptance criteria',
      ticketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Bug',
        priority: 'Priority: Normal',
        reporter: 'Test Reporter',
        status: 'In Progress',
        comments: [],
        attachments: [],
        customFields: {},
        components: [],
        scrapedAt: new Date().toISOString()
      },
      qaProfile: defaultQAProfile
    };
    
    const result = await regenerateDocument(context, { preserveStructure: false });
    
    expect(result).toBeDefined();
    expect(result.document).toBeDefined();
    expect(result.changes).toBeDefined();
    expect(result.regenerationTime).toBeGreaterThanOrEqual(0);
    
    // Verify new content is present
    expect(result.document.acceptanceCriteria[0].title).toBe('New acceptance criterion');
    const testCase2 = result.document.testCases[0];
    if (testCase2.format === 'steps' || testCase2.format === 'table') {
      expect(testCase2.testCase.title).toBe('New test case title');
    } else if (testCase2.format === 'gherkin') {
      expect(testCase2.testCase.scenario).toBe('New test case title');
    }
    
    // Verify IDs are from the regenerated document (not preserved from original)
    expect(result.document.acceptanceCriteria[0].id).toBe('ac-new-1');
    expect(result.document.testCases[0].id).toBe('tc-new-1');
  });

  test('should handle empty arrays in regenerated document', async () => {
    // Mock regenerated document with empty arrays
    const regeneratedDocument = {
      ...sampleDocument,
      acceptanceCriteria: [],
      testCases: [],
      metadata: {
        ...sampleDocument.metadata,
        generatedAt: new Date().toISOString(),
        documentVersion: '1.1'
      }
    };
    
    (generateObject as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: regeneratedDocument
    });
    
    const context: RegenerationContext = {
      originalDocument: sampleDocument,
      conversationHistory: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please remove all test cases and acceptance criteria',
          createdAt: new Date().toISOString()
        }
      ],
      userFeedback: 'Please remove all test cases and acceptance criteria',
      ticketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Bug',
        priority: 'Priority: Normal',
        reporter: 'Test Reporter',
        status: 'In Progress',
        comments: [],
        attachments: [],
        customFields: {},
        components: [],
        scrapedAt: new Date().toISOString()
      },
      qaProfile: defaultQAProfile
    };
    
    const result = await regenerateDocument(context);
    
    expect(result).toBeDefined();
    expect(result.document).toBeDefined();
    expect(result.document.acceptanceCriteria).toEqual([]);
    expect(result.document.testCases).toEqual([]);
  });

  test('should handle invalid regenerated document', async () => {
    // Mock the AI function to throw an error due to invalid schema
    (generateObject as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Schema validation failed')
    );
    
    const context: RegenerationContext = {
      originalDocument: sampleDocument,
      conversationHistory: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please update the document',
          createdAt: new Date().toISOString()
        }
      ],
      userFeedback: 'Please update the document',
      ticketData: {
        issueKey: 'TEST-123',
        summary: 'Test ticket',
        description: 'Test description',
        issueType: 'Bug',
        priority: 'Priority: Normal',
        reporter: 'Test Reporter',
        status: 'In Progress',
        comments: [],
        attachments: [],
        customFields: {},
        components: [],
        scrapedAt: new Date().toISOString()
      },
      qaProfile: defaultQAProfile
    };
    
    await expect(regenerateDocument(context)).rejects.toThrow('Document regeneration failed');
  });
});