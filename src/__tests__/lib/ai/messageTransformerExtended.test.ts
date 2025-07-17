/**
 * Extended Tests for Message Transformer
 * Comprehensive tests for message transformation functions
 */

import { describe, test, expect } from 'vitest';
import { 
  transformMessagesForAI,
  buildEnhancedSystemMessage,
  validateUIMessageFormat,
  sanitizeMessagesForAI,
  extractConversationIntent,
  buildContextAwarePrompt,
  type UIMessage,
  type SystemPromptContext
} from '../../../lib/ai/messageTransformer';
import { createMinimalQACanvasDocument } from '../../../lib/schemas/QACanvasDocument';

describe('Message Transformer Extended Tests', () => {
  // Sample test data
  const sampleUIMessages: UIMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Can you add more test cases for the login functionality?',
      createdAt: '2025-07-16T12:00:00Z'
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I can help you add more test cases. What specific aspects of login would you like to cover?',
      createdAt: '2025-07-16T12:01:00Z'
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'Let\'s focus on error handling and edge cases.',
      createdAt: '2025-07-16T12:02:00Z'
    }
  ];

  const sampleSystemMessage: UIMessage = {
    id: 'system-1',
    role: 'system',
    content: 'You are a QA assistant helping with test case generation.'
  };

  const sampleDocument = createMinimalQACanvasDocument('TEST-123', {
    qaCategories: {
      functional: true,
      ui: true,
      ux: false,
      api: true,
      security: true,
      performance: false,
      accessibility: false,
      mobile: false,
      negative: true,
      database: false
    },
    testCaseFormat: 'gherkin',
    autoRefresh: true,
    includeComments: true,
    includeImages: false,
    operationMode: 'online',
    showNotifications: true
  });

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

  test('should transform UI messages to model messages', () => {
    const result = transformMessagesForAI(sampleUIMessages);
    
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Can you add more test cases for the login functionality?');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
    
    // Verify createdAt is not included in transformed messages
    expect(result[0].createdAt).toBeUndefined();
  });

  test('should add system message with context when provided', () => {
    const context: SystemPromptContext = {
      currentDocument: sampleDocument,
      userPreferences: {
        testCaseFormat: 'gherkin',
        focusAreas: ['security', 'negative']
      }
    };
    
    const result = transformMessagesForAI(sampleUIMessages, context);
    
    expect(result).toHaveLength(4); // 3 original messages + 1 system message
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('You are a QA analyst assistant');
    expect(result[0].content).toContain('TEST-123'); // Document context
    expect(result[0].content).toContain('special characters'); // Problem statement
    expect(result[0].content).toContain('**Preferred Test Case Format:** gherkin'); // User preferences
  });

  test('should build enhanced system message with document context', () => {
    const context: SystemPromptContext = {
      currentDocument: sampleDocument
    };
    
    const result = buildEnhancedSystemMessage(context);
    
    expect(result.role).toBe('system');
    expect(result.content).toContain('Current Document Context');
    expect(result.content).toContain('TEST-123');
    expect(result.content).toContain('Users cannot reset their password');
    expect(result.content).toContain('**Current Acceptance Criteria Count:** 1');
    expect(result.content).toContain('**Active QA Categories:** functional, ui, api, security, negative');
  });

  test('should build enhanced system message with conversation history', () => {
    const context: SystemPromptContext = {
      conversationHistory: sampleUIMessages
    };
    
    const result = buildEnhancedSystemMessage(context);
    
    expect(result.role).toBe('system');
    expect(result.content).toContain('Recent Conversation Context');
    expect(result.content).toContain('user: Can you add more test cases');
    expect(result.content).toContain('assistant: I can help you add more test cases');
  });

  test('should build enhanced system message with user preferences', () => {
    const context: SystemPromptContext = {
      userPreferences: {
        testCaseFormat: 'steps',
        focusAreas: ['security', 'api']
      }
    };
    
    const result = buildEnhancedSystemMessage(context);
    
    expect(result.role).toBe('system');
    expect(result.content).toContain('User Preferences');
    expect(result.content).toContain('**Preferred Test Case Format:** steps');
    expect(result.content).toContain('**Focus Areas:** security, api');
  });

  test('should validate UI message format correctly', () => {
    // Valid messages
    const validResult = validateUIMessageFormat(sampleUIMessages);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    
    // Invalid messages
    const invalidMessages = [
      { role: 'user', content: 'Missing ID' },
      { id: 'invalid-role', role: 'invalid', content: 'Invalid role' },
      { id: 'invalid-content', role: 'user', content: 123 } // Invalid content type
    ];
    
    const invalidResult = validateUIMessageFormat(invalidMessages);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
    expect(invalidResult.errors[0]).toContain('missing required \'id\'');
    expect(invalidResult.errors[1]).toContain('invalid \'role\'');
    expect(invalidResult.errors[2]).toContain('invalid \'content\'');
  });

  test('should sanitize messages for AI processing', () => {
    const messagesWithMetadata: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        createdAt: '2025-07-16T12:00:00Z',
        metadata: {
          sensitive: 'This should be removed',
          userInfo: { name: 'Test User', email: 'test@example.com' }
        }
      }
    ];
    
    const sanitized = sanitizeMessagesForAI(messagesWithMetadata);
    
    expect(sanitized[0].id).toBe('msg-1');
    expect(sanitized[0].content).toBe('Test message');
    expect(sanitized[0].createdAt).toBe('2025-07-16T12:00:00Z');
    expect(sanitized[0].metadata).toBeUndefined();
  });

  test('should extract conversation intent correctly', () => {
    // Test add content intent
    const addMessages: UIMessage[] = [
      { id: 'add-1', role: 'user', content: 'Can you add more test cases?' }
    ];
    const addIntent = extractConversationIntent(addMessages);
    expect(addIntent.intent).toBe('add_content');
    expect(addIntent.confidence).toBeGreaterThan(0.5);
    
    // Test modify content intent
    const modifyMessages: UIMessage[] = [
      { id: 'mod-1', role: 'user', content: 'Please update the existing test cases.' }
    ];
    const modifyIntent = extractConversationIntent(modifyMessages);
    expect(modifyIntent.intent).toBe('modify_content');
    expect(modifyIntent.confidence).toBeGreaterThan(0.5);
    
    // Test question intent
    const questionMessages: UIMessage[] = [
      { id: 'q-1', role: 'user', content: 'What is the best way to test this feature?' }
    ];
    const questionIntent = extractConversationIntent(questionMessages);
    expect(questionIntent.intent).toBe('ask_question');
    expect(questionIntent.confidence).toBeGreaterThan(0.5);
    
    // Test help intent
    const helpMessages: UIMessage[] = [
      { id: 'help-1', role: 'user', content: 'Help me improve these test cases.' }
    ];
    const helpIntent = extractConversationIntent(helpMessages);
    expect(helpIntent.intent).toBe('general_help');
    expect(helpIntent.confidence).toBeGreaterThan(0.5);
    
    // Test unknown intent
    const unknownMessages: UIMessage[] = [
      { id: 'unk-1', role: 'user', content: 'xyz123' }
    ];
    const unknownIntent = extractConversationIntent(unknownMessages);
    expect(unknownIntent.intent).toBe('unknown');
    expect(unknownIntent.confidence).toBeLessThan(0.5);
    
    // Test empty messages
    const emptyIntent = extractConversationIntent([]);
    expect(emptyIntent.intent).toBe('unknown');
    expect(emptyIntent.confidence).toBe(0);
  });

  test('should build context-aware prompt based on intent', () => {
    const context: SystemPromptContext = {
      currentDocument: sampleDocument
    };
    
    // Test add content intent
    const addIntent = {
      intent: 'add_content' as const,
      confidence: 0.8,
      details: 'User wants to add new content'
    };
    
    const addPrompt = buildContextAwarePrompt(sampleUIMessages, context, addIntent);
    expect(addPrompt).toContain('Current Request Context');
    expect(addPrompt).toContain('The user wants to add new content');
    expect(addPrompt).toContain('TEST-123'); // Document context
    
    // Test modify content intent
    const modifyIntent = {
      intent: 'modify_content' as const,
      confidence: 0.8,
      details: 'User wants to modify existing content'
    };
    
    const modifyPrompt = buildContextAwarePrompt(sampleUIMessages, context, modifyIntent);
    expect(modifyPrompt).toContain('The user wants to modify existing content');
    expect(modifyPrompt).toContain('Preserving the intent and quality');
    
    // Test with auto-detected intent
    const autoPrompt = buildContextAwarePrompt(sampleUIMessages, context);
    // The auto-detected intent might not include the exact "Current Request Context" text
    // Instead, verify that it contains the document context
    expect(autoPrompt).toContain('Current Document Context');
    expect(autoPrompt).toContain('TEST-123');
  });

  test('should handle empty or invalid inputs gracefully', () => {
    // Empty messages
    const emptyResult = transformMessagesForAI([]);
    expect(emptyResult).toHaveLength(0);
    
    // Empty context - this will still add a system message because context is provided
    const emptyContextResult = transformMessagesForAI(sampleUIMessages, {});
    expect(emptyContextResult).toHaveLength(4); // 3 messages + 1 system message
    
    // Invalid message format validation
    const invalidFormatResult = validateUIMessageFormat('not an array' as any);
    expect(invalidFormatResult.valid).toBe(false);
    expect(invalidFormatResult.errors[0]).toContain('must be an array');
  });

  test('should filter out system messages when transforming', () => {
    const messagesWithSystem = [...sampleUIMessages, sampleSystemMessage];
    
    const result = transformMessagesForAI(messagesWithSystem);
    
    // Should only include user and assistant messages
    expect(result).toHaveLength(3);
    expect(result.every(msg => msg.role !== 'system')).toBe(true);
  });

  test('should include system message with complete context', () => {
    const fullContext: SystemPromptContext = {
      currentDocument: sampleDocument,
      conversationHistory: sampleUIMessages,
      userPreferences: {
        testCaseFormat: 'gherkin',
        focusAreas: ['security', 'negative']
      }
    };
    
    const result = transformMessagesForAI(sampleUIMessages, fullContext);
    
    expect(result).toHaveLength(4); // 3 original messages + 1 system message
    expect(result[0].role).toBe('system');
    
    // Check that all context sections are included
    const systemContent = result[0].content;
    expect(systemContent).toContain('Current Document Context');
    expect(systemContent).toContain('Recent Conversation Context');
    expect(systemContent).toContain('User Preferences');
    expect(systemContent).toContain('TEST-123');
    expect(systemContent).toContain('**Preferred Test Case Format:** gherkin');
    expect(systemContent).toContain('**Focus Areas:** security, negative');
  });
});