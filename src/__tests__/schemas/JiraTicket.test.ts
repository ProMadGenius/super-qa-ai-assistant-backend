import {
  jiraTicketSchema,
  jiraCommentSchema,
  jiraAttachmentSchema,
  commentImageSchema,
  type JiraTicket,
  type JiraComment,
  type JiraAttachment,
  type CommentImage
} from '@/lib/schemas/JiraTicket'
import { describe, it, expect } from 'vitest'

describe('JiraTicket Schema Validation', () => {
  const validCommentImage: CommentImage = {
    alt: 'test-image.png',
    filename: 'test-image-123',
    height: 200,
    isAttachment: true,
    mimeType: 'image/png',
    src: 'blob:https://example.com/test-image',
    title: 'Test Image',
    width: 300
  }

  const validJiraComment: JiraComment = {
    author: 'Jane Smith',
    body: 'This is a test comment with @mentions',
    date: 'January 15, 2024 at 10:30 AM',
    images: [validCommentImage],
    links: ['https://example.com/link1']
  }

  const validJiraAttachment: JiraAttachment = {
    data: 'base64string...',
    mime: 'image/png',
    name: 'test-attachment.png',
    size: 145539,
    tooBig: false,
    url: 'blob:https://example.com/attachment-url'
  }

  const validJiraTicket: JiraTicket = {
    issueKey: 'PROJ-123',
    summary: 'Fix login button not working',
    description: 'The login button on the homepage is not responding to clicks',
    status: 'In Progress',
    priority: 'Priority: High',
    issueType: 'Bug',
    assignee: 'John Doe',
    reporter: 'Jane Smith',
    comments: [validJiraComment],
    attachments: [validJiraAttachment],
    components: ['Frontend', 'Authentication'],
    customFields: {
      acceptance_criteria: 'Login should work properly',
      story_points: '3',
      epic_link: 'PROJ-100'
    },
    processingComplete: true,
    scrapedAt: '2024-01-15T13:00:00Z'
  }

  describe('commentImageSchema', () => {
    it('should validate valid comment image', () => {
      const result = commentImageSchema.safeParse(validCommentImage)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validCommentImage)
      }
    })

    it('should reject image with missing required fields', () => {
      const incompleteImage = {
        alt: 'test.png',
        filename: 'test-123'
        // missing other required fields
      }

      const result = commentImageSchema.safeParse(incompleteImage)
      expect(result.success).toBe(false)
    })

    it('should validate image dimensions as numbers', () => {
      const imageWithStringDimensions = {
        ...validCommentImage,
        height: '200', // string instead of number
        width: '300'   // string instead of number
      }

      const result = commentImageSchema.safeParse(imageWithStringDimensions)
      expect(result.success).toBe(false)
    })
  })

  describe('jiraCommentSchema', () => {
    it('should validate valid comment with images and links', () => {
      const result = jiraCommentSchema.safeParse(validJiraComment)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validJiraComment)
      }
    })

    it('should validate comment with empty images and links arrays', () => {
      const commentWithEmptyArrays = {
        author: 'John Doe',
        body: 'Simple comment without media',
        date: 'January 16, 2024 at 2:00 PM',
        images: [],
        links: []
      }

      const result = jiraCommentSchema.safeParse(commentWithEmptyArrays)
      expect(result.success).toBe(true)
    })

    it('should default empty arrays when images/links not provided', () => {
      const minimalComment = {
        author: 'Test Author',
        body: 'Test comment body',
        date: 'January 17, 2024 at 3:00 PM'
      }

      const result = jiraCommentSchema.safeParse(minimalComment)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.images).toEqual([])
        expect(result.data.links).toEqual([])
      }
    })

    it('should reject comment with missing required fields', () => {
      const incompleteComment = {
        author: 'Test Author'
        // missing body and date
      }

      const result = jiraCommentSchema.safeParse(incompleteComment)
      expect(result.success).toBe(false)
    })
  })

  describe('jiraAttachmentSchema', () => {
    it('should validate valid attachment', () => {
      const result = jiraAttachmentSchema.safeParse(validJiraAttachment)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validJiraAttachment)
      }
    })

    it('should validate attachment with different mime types', () => {
      const csvAttachment = {
        data: 'base64csvdata...',
        mime: 'text/csv',
        name: 'data.csv',
        size: 1024,
        tooBig: false,
        url: 'blob:https://example.com/csv-file'
      }

      const result = jiraAttachmentSchema.safeParse(csvAttachment)
      expect(result.success).toBe(true)
    })

    it('should validate large attachment marked as tooBig', () => {
      const largeAttachment = {
        data: '',
        mime: 'application/pdf',
        name: 'large-document.pdf',
        size: 50000000,
        tooBig: true,
        url: 'blob:https://example.com/large-file'
      }

      const result = jiraAttachmentSchema.safeParse(largeAttachment)
      expect(result.success).toBe(true)
    })

    it('should reject attachment with missing required fields', () => {
      const incompleteAttachment = {
        name: 'test.pdf',
        size: 1024
        // missing other required fields
      }

      const result = jiraAttachmentSchema.safeParse(incompleteAttachment)
      expect(result.success).toBe(false)
    })
  })

  describe('jiraTicketSchema', () => {
    it('should validate complete valid ticket', () => {
      const result = jiraTicketSchema.safeParse(validJiraTicket)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validJiraTicket)
      }
    })

    it('should validate minimal ticket with only required fields', () => {
      const minimalTicket = {
        issueKey: 'PROJ-456',
        summary: 'Simple task',
        description: 'A simple task description',
        status: 'To Do',
        priority: 'Priority: Medium',
        issueType: 'Task',
        reporter: 'Test Reporter',
        customFields: {},
        scrapedAt: '2024-01-15T13:00:00Z'
      }

      const result = jiraTicketSchema.safeParse(minimalTicket)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.comments).toEqual([])
        expect(result.data.attachments).toEqual([])
        expect(result.data.components).toEqual([])
      }
    })

    it('should validate ticket with string assignee and reporter', () => {
      const ticketWithStringUsers = {
        ...validJiraTicket,
        assignee: 'John Smith',
        reporter: 'Jane Doe'
      }

      const result = jiraTicketSchema.safeParse(ticketWithStringUsers)
      expect(result.success).toBe(true)
    })

    it('should validate ticket without optional assignee', () => {
      const ticketWithoutAssignee = {
        issueKey: 'PROJ-789',
        summary: 'Unassigned ticket',
        description: 'This ticket has no assignee',
        status: 'Open',
        priority: 'Priority: Low',
        issueType: 'Story',
        reporter: 'Product Owner',
        customFields: { priority: 'low' },
        scrapedAt: '2024-01-15T13:00:00Z'
      }

      const result = jiraTicketSchema.safeParse(ticketWithoutAssignee)
      expect(result.success).toBe(true)
    })

    it('should validate ticket with complex custom fields', () => {
      const ticketWithComplexCustomFields = {
        ...validJiraTicket,
        customFields: {
          acceptance_criteria: 'Detailed acceptance criteria',
          story_points: 5,
          labels: ['bug', 'urgent'],
          fix_versions: ['v1.2.0'],
          nested_object: {
            key: 'value',
            number: 42
          }
        }
      }

      const result = jiraTicketSchema.safeParse(ticketWithComplexCustomFields)
      expect(result.success).toBe(true)
    })

    it('should reject ticket with missing required fields', () => {
      const incompleteTicket = {
        issueKey: 'PROJ-999',
        summary: 'Incomplete ticket'
        // missing description, status, priority, issueType, reporter, customFields, scrapedAt
      }

      const result = jiraTicketSchema.safeParse(incompleteTicket)
      expect(result.success).toBe(false)
    })

    it('should handle empty arrays for comments, attachments, and components', () => {
      const ticketWithEmptyArrays = {
        ...validJiraTicket,
        comments: [],
        attachments: [],
        components: []
      }

      const result = jiraTicketSchema.safeParse(ticketWithEmptyArrays)
      expect(result.success).toBe(true)
    })

    it('should validate ticket with multiple components', () => {
      const ticketWithMultipleComponents = {
        ...validJiraTicket,
        components: ['Frontend', 'Backend', 'Database', 'API']
      }

      const result = jiraTicketSchema.safeParse(ticketWithMultipleComponents)
      expect(result.success).toBe(true)
    })
  })

  describe('Real Data Structure Compatibility', () => {
    it('should validate ticket structure matching Chrome extension output', () => {
      const realStyleTicket = {
        issueKey: 'EN-8775',
        summary: 'REWORK Unable to reverse these payments',
        description: 'in reference to case 661432. Using a payment made from LabCorp...',
        status: 'Done',
        priority: 'Priority: Normal',
        issueType: 'Bug',
        assignee: 'Fred Solovyev',
        reporter: 'Exalate',
        comments: [
          {
            author: 'Lisa Thomas',
            body: '@Fred Solovyev I would rather not close this out for now…',
            date: 'July 14, 2025 at 8:45 AM',
            images: [],
            links: []
          }
        ],
        attachments: [
          {
            data: 'base64string...',
            mime: 'image/png',
            name: 'image-20250703-191721.png',
            size: 145539,
            tooBig: false,
            url: 'blob:https://amtech.atlassian.net/86ef9a01-37c3-48cb-83aa-4afeac66f672'
          }
        ],
        components: ['Accounts Receivable'],
        customFields: {
          acceptance_criteria: 'Add Attachment',
          affects_versions: 'None',
          issue_type: 'Bug',
          labels: 'Regression, Rework'
        },
        processingComplete: true,
        scrapedAt: '2025-07-15T23:56:47.427Z'
      }

      const result = jiraTicketSchema.safeParse(realStyleTicket)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issueKey).toBe('EN-8775')
        expect(result.data.components).toContain('Accounts Receivable')
        expect(result.data.customFields.labels).toBe('Regression, Rework')
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(jiraTicketSchema.safeParse(null).success).toBe(false)
      expect(jiraTicketSchema.safeParse(undefined).success).toBe(false)
      expect(jiraCommentSchema.safeParse(null).success).toBe(false)
      expect(jiraAttachmentSchema.safeParse(null).success).toBe(false)
      expect(commentImageSchema.safeParse(null).success).toBe(false)
    })

    it('should handle empty objects', () => {
      expect(jiraTicketSchema.safeParse({}).success).toBe(false)
      expect(jiraCommentSchema.safeParse({}).success).toBe(false)
      expect(jiraAttachmentSchema.safeParse({}).success).toBe(false)
      expect(commentImageSchema.safeParse({}).success).toBe(false)
    })

    it('should handle arrays instead of objects', () => {
      expect(jiraTicketSchema.safeParse([]).success).toBe(false)
      expect(jiraCommentSchema.safeParse([]).success).toBe(false)
      expect(jiraAttachmentSchema.safeParse([]).success).toBe(false)
      expect(commentImageSchema.safeParse([]).success).toBe(false)
    })
  })
})