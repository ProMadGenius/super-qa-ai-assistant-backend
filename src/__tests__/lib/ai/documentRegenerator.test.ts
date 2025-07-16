import {
  regenerateDocument,
  trackDocumentChanges,
  RegenerationContext,
  RegenerationOptions
} from '@/lib/ai/documentRegenerator'
import { QACanvasDocument } from '@/lib/schemas/QACanvasDocument'
import { defaultQAProfile } from '@/lib/schemas/QAProfile'
import { UIMessage } from '@/lib/ai/messageTransformer'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the AI SDK
vi.mock('ai', () => {
  return {
    generateObject: vi.fn()
  }
})

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-openai-model')
}))

// Import the mocked modules
import * as ai from 'ai'

describe('Document Regenerator', () => {
  const mockTicket = {
    issueKey: 'TEST-123',
    summary: 'Fix login button not working',
    description: 'The login button is unresponsive on mobile devices',
    status: 'In Progress',
    priority: 'Priority: High',
    issueType: 'Bug',
    assignee: 'Developer',
    reporter: 'QA Tester',
    comments: [],
    attachments: [],
    components: ['Frontend', 'Mobile'],
    customFields: {},
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  const mockOriginalDocument: QACanvasDocument = {
    ticketSummary: {
      problem: 'Login button not working on mobile',
      solution: 'Fix button click handler',
      context: 'Mobile application issue'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Login button works',
        description: 'User can click login button successfully',
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
          scenario: 'User clicks login button',
          given: ['User is on login page'],
          when: ['User clicks login button'],
          then: ['Login process starts'],
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

  const mockConversationHistory: UIMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Can you add more test cases for edge cases?'
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I can help you add more comprehensive test scenarios.'
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'Please add test cases for error handling and network failures'
    }
  ]

  const mockRegeneratedDocument: QACanvasDocument = {
    ticketSummary: {
      problem: 'Login button not working on mobile devices',
      solution: 'Fix button click handler and add error handling',
      context: 'Mobile application with network connectivity issues'
    },
    configurationWarnings: [],
    acceptanceCriteria: [
      {
        id: 'ac-1',
        title: 'Login button works',
        description: 'User can click login button successfully',
        priority: 'must',
        category: 'functional',
        testable: true
      },
      {
        id: 'ac-2',
        title: 'Error handling works',
        description: 'System handles network errors gracefully',
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
          scenario: 'User clicks login button',
          given: ['User is on login page'],
          when: ['User clicks login button'],
          then: ['Login process starts'],
          tags: []
        }
      },
      {
        format: 'gherkin',
        id: 'tc-2',
        category: 'functional',
        priority: 'high',
        testCase: {
          scenario: 'Login fails due to network error',
          given: ['User is on login page', 'Network connection is unstable'],
          when: ['User clicks login button'],
          then: ['Error message is displayed', 'User can retry login'],
          tags: ['@error-handling']
        }
      }
    ],
    metadata: {
      generatedAt: '2024-01-15T13:05:00Z',
      qaProfile: defaultQAProfile,
      ticketId: 'TEST-123',
      documentVersion: '1.1'
    }
  }

  describe('regenerateDocument', () => {
    const mockContext: RegenerationContext = {
      originalDocument: mockOriginalDocument,
      conversationHistory: mockConversationHistory,
      userFeedback: 'Please add more test cases for error handling',
      ticketData: mockTicket,
      qaProfile: defaultQAProfile
    }

    beforeEach(() => {
      vi.clearAllMocks()
      // Set up the mock implementation
      vi.mocked(ai.generateObject).mockResolvedValue({
        object: mockRegeneratedDocument,
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        warnings: [],
        request: { model: 'mocked-openai-model', prompt: '', schema: {} }
      })
    })

    it('should regenerate document successfully', async () => {
      const result = await regenerateDocument(mockContext)

      expect(result.document).toBeDefined()
      expect(result.changes).toBeDefined()
      expect(result.regenerationTime).toBeGreaterThanOrEqual(0)
      expect(result.preservedElements).toBeDefined()
      expect(result.modifiedElements).toBeDefined()

      // Check that metadata is updated
      expect(result.document.metadata.documentVersion).toBe('1.1')
      expect(result.document.metadata.previousVersion).toBe('1.0')
      expect(result.document.metadata.regenerationReason).toContain('Content addition')
    })

    it('should use custom options when provided', async () => {
      const options: RegenerationOptions = {
        temperature: 0.5,
        model: 'gpt-4-turbo',
        regenerationMode: 'targeted',
        focusAreas: ['testCases']
      }

      await regenerateDocument(mockContext, options)

      expect(ai.generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          model: 'mocked-openai-model'
        })
      )
    })

    it('should build comprehensive regeneration prompt', async () => {
      await regenerateDocument(mockContext)

      const promptCall = vi.mocked(ai.generateObject).mock.calls[0][0]
      expect(promptCall.prompt).toContain('TEST-123')
      expect(promptCall.prompt).toContain('Fix login button not working')
      expect(promptCall.prompt).toContain('Please add more test cases for error handling')
      expect(promptCall.prompt).toContain('user: Can you add more test cases')
      expect(promptCall.prompt).toContain('Active Categories:')
    })

    it('should handle regeneration errors', async () => {
      vi.mocked(ai.generateObject).mockRejectedValue(new Error('AI generation failed'))

      await expect(regenerateDocument(mockContext)).rejects.toThrow('Document regeneration failed')
    })

    it('should track changes correctly', async () => {
      const result = await regenerateDocument(mockContext)

      expect(result.changes.length).toBeGreaterThan(0)

      // Should detect that test cases were added
      const testCaseChange = result.changes.find(c => c.section === 'testCases')
      expect(testCaseChange).toBeDefined()
      expect(testCaseChange?.changeType).toBe('added')

      // Should detect that acceptance criteria were added
      const acChange = result.changes.find(c => c.section === 'acceptanceCriteria')
      expect(acChange).toBeDefined()
      expect(acChange?.changeType).toBe('added')
    })

    it('should categorize preserved and modified elements', async () => {
      const result = await regenerateDocument(mockContext)

      expect(result.preservedElements).toBeInstanceOf(Array)
      expect(result.modifiedElements).toBeInstanceOf(Array)

      // Should have some modified elements due to additions
      expect(result.modifiedElements.length).toBeGreaterThan(0)
    })

    it('should increment version correctly', async () => {
      const result = await regenerateDocument(mockContext)

      expect(result.document.metadata.documentVersion).toBe('1.1')
      expect(result.document.metadata.previousVersion).toBe('1.0')
    })

    it('should extract regeneration reason from feedback', async () => {
      const contexts = [
        { ...mockContext, userFeedback: 'Add more test cases' },
        { ...mockContext, userFeedback: 'Change the existing criteria' },
        { ...mockContext, userFeedback: 'Improve the quality of tests' },
        { ...mockContext, userFeedback: 'Fix the incorrect test case' }
      ]

      const expectedReasons = [
        'Content addition requested',
        'Content modification requested',
        'Quality improvement requested',
        'Error correction requested'
      ]

      for (let i = 0; i < contexts.length; i++) {
        vi.mocked(ai.generateObject).mockResolvedValue({
          object: mockRegeneratedDocument,
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          warnings: [],
          request: { model: 'mocked-openai-model', prompt: '', schema: {} }
        })
        const result = await regenerateDocument(contexts[i])
        expect(result.document.metadata.regenerationReason).toBe(expectedReasons[i])
      }
    })
  })

  describe('trackDocumentChanges', () => {
    it('should detect no changes when documents are identical', () => {
      const changes = trackDocumentChanges(mockOriginalDocument, mockOriginalDocument)

      expect(changes.length).toBe(3) // ticketSummary, acceptanceCriteria, testCases
      expect(changes.every(c => c.changeType === 'preserved')).toBe(true)
    })

    it('should detect ticket summary changes', () => {
      const modifiedDoc = {
        ...mockOriginalDocument,
        ticketSummary: {
          ...mockOriginalDocument.ticketSummary,
          problem: 'Updated problem statement'
        }
      }

      const changes = trackDocumentChanges(mockOriginalDocument, modifiedDoc)
      const summaryChange = changes.find(c => c.section === 'ticketSummary')

      expect(summaryChange?.changeType).toBe('modified')
      expect(summaryChange?.description).toContain('Ticket summary updated')
    })

    it('should detect acceptance criteria additions', () => {
      const modifiedDoc = {
        ...mockOriginalDocument,
        acceptanceCriteria: [
          ...mockOriginalDocument.acceptanceCriteria,
          {
            id: 'ac-2',
            title: 'New criteria',
            description: 'Additional requirement',
            priority: 'should' as const,
            category: 'functional' as const,
            testable: true
          }
        ]
      }

      const changes = trackDocumentChanges(mockOriginalDocument, modifiedDoc)
      const acChange = changes.find(c => c.section === 'acceptanceCriteria')

      expect(acChange?.changeType).toBe('added')
      expect(acChange?.oldValue).toBe(1)
      expect(acChange?.newValue).toBe(2)
    })

    it('should detect test case additions', () => {
      const modifiedDoc = {
        ...mockOriginalDocument,
        testCases: [
          ...mockOriginalDocument.testCases,
          {
            format: 'gherkin' as const,
            id: 'tc-2',
            category: 'functional',
            priority: 'medium' as const,
            testCase: {
              scenario: 'New test scenario',
              given: ['Given condition'],
              when: ['When action'],
              then: ['Then result'],
              tags: []
            }
          }
        ]
      }

      const changes = trackDocumentChanges(mockOriginalDocument, modifiedDoc)
      const tcChange = changes.find(c => c.section === 'testCases')

      expect(tcChange?.changeType).toBe('added')
      expect(tcChange?.oldValue).toBe(1)
      expect(tcChange?.newValue).toBe(2)
    })

    it('should detect configuration warning changes', () => {
      const modifiedDoc = {
        ...mockOriginalDocument,
        configurationWarnings: [
          {
            type: 'category_mismatch' as const,
            title: 'New Warning',
            message: 'Warning message',
            recommendation: 'Fix this',
            severity: 'medium' as const
          }
        ]
      }

      const changes = trackDocumentChanges(mockOriginalDocument, modifiedDoc)
      const warningChange = changes.find(c => c.section === 'configurationWarnings')

      expect(warningChange?.changeType).toBe('added')
      expect(warningChange?.oldValue).toBe(0)
      expect(warningChange?.newValue).toBe(1)
    })
  })
})