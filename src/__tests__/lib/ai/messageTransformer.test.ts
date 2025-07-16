import {
  transformMessagesForAI,
  buildEnhancedSystemMessage,
  validateUIMessageFormat,
  sanitizeMessagesForAI,
  extractConversationIntent,
  buildContextAwarePrompt,
  UIMessage,
  SystemPromptContext
} from '@/lib/ai/messageTransformer'
import { QACanvasDocument } from '@/lib/schemas/QACanvasDocument'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'

// Mock the AI SDK
jest.mock('ai', () => ({
  convertToModelMessages: jest.fn((messages) => 
    messages.map((msg: any) => ({ role: msg.role, content: msg.content }))
  )
}))

describe('Message Transformer', () => {
  const mockMessages: UIMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Can you add more test cases for edge cases?',
      createdAt: '2024-01-15T13:00:00Z'
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I can help you add more edge case test scenarios.',
      createdAt: '2024-01-15T13:01:00Z'
    }
  ]

  const mockDocument: QACanvasDocument = {
    ticketSummary: {
      problem: 'Login button not working',
      solution: 'Fix button click handler',
      context: 'Mobile application'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Login works',
        description: 'User can login successfully',
        priority: 'must',
        category: 'functional',
        testable: true
      }
    ],
    testCases: [
      {
        format: 'gherkin',
        id: 'tc-1',
        category: 'functional',
        priority: 'high',
        testCase: {
          scenario: 'User logs in',
          given: ['User is on login page'],
          when: ['User clicks login'],
          then: ['User is logged in'],
          tags: []
        }
      }
    ],
    metadata: {
      generatedAt: '2024-01-15T13:00:00Z',
      qaProfile: defaultQAProfile,
      ticketId: 'TEST-123',
      documentVersion: '1.0'
    }
  }

  describe('transformMessagesForAI', () => {
    it('should transform UI messages to model messages', () => {
      const result = transformMessagesForAI(mockMessages)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ role: 'user', content: 'Can you add more test cases for edge cases?' })
      expect(result[1]).toEqual({ role: 'assistant', content: 'I can help you add more edge case test scenarios.' })
    })

    it('should add system message when context is provided', () => {
      const context: SystemPromptContext = {
        currentDocument: mockDocument
      }
      
      const result = transformMessagesForAI(mockMessages, context)
      
      expect(result).toHaveLength(3) // system + 2 original messages
      expect(result[0].role).toBe('system')
      expect(result[0].content).toContain('QA analyst assistant')
    })

    it('should filter out existing system messages', () => {
      const messagesWithSystem: UIMessage[] = [
        {
          id: 'sys-1',
          role: 'system',
          content: 'You are a helpful assistant'
        },
        ...mockMessages
      ]
      
      const result = transformMessagesForAI(messagesWithSystem)
      
      expect(result).toHaveLength(2) // Only user and assistant messages
      expect(result.every(msg => msg.role !== 'system')).toBe(true)
    })
  })

  describe('buildEnhancedSystemMessage', () => {
    it('should build basic system message without context', () => {
      const context: SystemPromptContext = {}
      const result = buildEnhancedSystemMessage(context)
      
      expect(result.role).toBe('system')
      expect(result.content).toContain('QA analyst assistant')
      expect(result.content).toContain('refine and improve QA documentation')
    })

    it('should include document context when provided', () => {
      const context: SystemPromptContext = {
        currentDocument: mockDocument
      }
      
      const result = buildEnhancedSystemMessage(context)
      
      expect(result.content).toContain('Current Document Context')
      expect(result.content).toContain('TEST-123')
      expect(result.content).toContain('Login button not working')
      expect(result.content).toContain('**Current Test Cases Count:** 1')
    })

    it('should include conversation history when provided', () => {
      const context: SystemPromptContext = {
        conversationHistory: mockMessages
      }
      
      const result = buildEnhancedSystemMessage(context)
      
      expect(result.content).toContain('Recent Conversation Context')
      expect(result.content).toContain('user: Can you add more test cases')
    })

    it('should include user preferences when provided', () => {
      const context: SystemPromptContext = {
        userPreferences: {
          testCaseFormat: 'gherkin',
          focusAreas: ['functional', 'ui']
        }
      }
      
      const result = buildEnhancedSystemMessage(context)
      
      expect(result.content).toContain('User Preferences')
      expect(result.content).toContain('gherkin')
      expect(result.content).toContain('functional, ui')
    })
  })

  describe('validateUIMessageFormat', () => {
    it('should validate correct message format', () => {
      const result = validateUIMessageFormat(mockMessages)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should detect missing required fields', () => {
      const invalidMessages = [
        {
          // Missing id
          role: 'user',
          content: 'Test message'
        },
        {
          id: 'msg-2',
          // Missing role
          content: 'Another test'
        },
        {
          id: 'msg-3',
          role: 'user'
          // Missing content
        }
      ]
      
      const result = validateUIMessageFormat(invalidMessages)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Message 0 is missing required 'id' field")
      expect(result.errors).toContain("Message 1 has invalid 'role' field. Must be 'user', 'assistant', or 'system'")
      expect(result.errors).toContain("Message 2 has invalid 'content' field. Must be a string")
    })

    it('should detect invalid role values', () => {
      const invalidMessages = [
        {
          id: 'msg-1',
          role: 'invalid_role',
          content: 'Test message'
        }
      ]
      
      const result = validateUIMessageFormat(invalidMessages)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Message 0 has invalid 'role' field. Must be 'user', 'assistant', or 'system'")
    })

    it('should handle non-array input', () => {
      const result = validateUIMessageFormat('not an array' as any)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Messages must be an array')
    })
  })

  describe('sanitizeMessagesForAI', () => {
    it('should remove metadata and keep essential fields', () => {
      const messagesWithMetadata: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          createdAt: '2024-01-15T13:00:00Z',
          metadata: {
            sensitive: 'data',
            userId: '12345'
          }
        }
      ]
      
      const result = sanitizeMessagesForAI(messagesWithMetadata)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        createdAt: '2024-01-15T13:00:00Z'
      })
      expect(result[0]).not.toHaveProperty('metadata')
    })
  })

  describe('extractConversationIntent', () => {
    it('should detect add content intent', () => {
      const addMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Can you add more test cases for this feature?'
        }
      ]
      
      const result = extractConversationIntent(addMessages)
      
      expect(result.intent).toBe('add_content')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.details).toContain('add new content')
    })

    it('should detect modify content intent', () => {
      const modifyMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please update the existing test case to be more specific'
        }
      ]
      
      const result = extractConversationIntent(modifyMessages)
      
      expect(result.intent).toBe('modify_content')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.details).toContain('modify existing content')
    })

    it('should detect question intent', () => {
      const questionMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What are the best practices for writing acceptance criteria?'
        }
      ]
      
      const result = extractConversationIntent(questionMessages)
      
      expect(result.intent).toBe('ask_question')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.details).toContain('asking a question')
    })

    it('should detect help intent', () => {
      const helpMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Please help me with writing better test cases'
        }
      ]
      
      const result = extractConversationIntent(helpMessages)
      
      expect(result.intent).toBe('general_help')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.details).toContain('general help')
    })

    it('should return unknown for unclear intent', () => {
      const unclearMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello there'
        }
      ]
      
      const result = extractConversationIntent(unclearMessages)
      
      expect(result.intent).toBe('unknown')
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should handle empty messages array', () => {
      const result = extractConversationIntent([])
      
      expect(result.intent).toBe('unknown')
      expect(result.confidence).toBe(0)
    })
  })

  describe('buildContextAwarePrompt', () => {
    it('should build prompt with add content context', () => {
      const addMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Add more test cases'
        }
      ]
      
      const context: SystemPromptContext = {
        currentDocument: mockDocument
      }
      
      const result = buildContextAwarePrompt(addMessages, context)
      
      expect(result).toContain('Current Request Context')
      expect(result).toContain('add new content')
      expect(result).toContain('Current Document Context')
    })

    it('should build prompt with modify content context', () => {
      const modifyMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Change the existing test case'
        }
      ]
      
      const context: SystemPromptContext = {
        currentDocument: mockDocument
      }
      
      const result = buildContextAwarePrompt(modifyMessages, context)
      
      expect(result).toContain('modify existing content')
      expect(result).toContain('Preserving the intent and quality')
    })

    it('should build prompt with question context', () => {
      const questionMessages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What should I test for this feature?'
        }
      ]
      
      const context: SystemPromptContext = {}
      
      const result = buildContextAwarePrompt(questionMessages, context)
      
      expect(result).toContain('user has a question')
      expect(result).toContain('clear, specific answers')
    })

    it('should use provided intent instead of detecting', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello'
        }
      ]
      
      const context: SystemPromptContext = {}
      const providedIntent = {
        intent: 'add_content' as const,
        confidence: 0.9,
        details: 'Manually provided intent'
      }
      
      const result = buildContextAwarePrompt(messages, context, providedIntent)
      
      expect(result).toContain('add new content')
    })
  })
})