import { validateTicketAnalysisPayload } from '@/lib/schemas/TicketAnalysisPayload'
import { qaProfileSchema } from '@/lib/schemas/QAProfile'
import { jiraTicketSchema } from '@/lib/schemas/JiraTicket'

describe('Real Data Validation', () => {
  // Real example data from EN-8775-full.json (complete structure)
  const realExampleData = {
    "qaProfile": {
      "autoRefresh": true,
      "includeComments": true,
      "includeImages": true,
      "operationMode": "offline",
      "showNotifications": true,
      "testCaseFormat": "gherkin",
      "qaCategories": {
        "functional": true,
        "ux": true,
        "ui": true,
        "negative": true,
        "api": false,
        "database": false,
        "performance": false,
        "security": false,
        "mobile": true,
        "accessibility": true
      }
    },
    "ticketJson": {
      "assignee": "Fred Solovyev",
      "attachments": [
        {
          "data": "base64string...",
          "mime": "image/png",
          "name": "image-20250703-191721.png",
          "size": 145539,
          "tooBig": false,
          "url": "blob:https://amtech.atlassian.net/86ef9a01-37c3-48cb-83aa-4afeac66f672"
        }
      ],
      "comments": [
        {
          "author": "Lisa Thomas",
          "body": "@Fred Solovyev I would rather not close this out for now… I'd like to keep it open.",
          "date": "July 14, 2025 at 8:45 AM",
          "images": [],
          "links": []
        }
      ],
      "components": [
        "Accounts Receivable"
      ],
      "customFields": {
        "acceptance_criteria": "Add Attachment",
        "affects_versions": "None",
        "issue_type": "Bug",
        "labels": "Regression, Rework"
      },
      "description": "in reference to case 661432. Using a payment made from LabCorp as a reference this is what I found.",
      "issueKey": "EN-8775",
      "issueType": "Bug",
      "priority": "Priority: Normal",
      "processingComplete": true,
      "reporter": "Exalate",
      "scrapedAt": "2025-07-15T23:56:47.427Z",
      "status": "Done",
      "summary": "REWORK Unable to reverse these payments and correct them because I have no way to pull up the transaction."
    }
  }

  describe('Updated Schema Validation Against Real Data', () => {
    it('should successfully validate real data with updated schemas', () => {
      const result = validateTicketAnalysisPayload(realExampleData)
      
      if (!result.success) {
        console.log('Schema validation errors:')
        result.error.issues.forEach((issue, index) => {
          console.log(`${index + 1}. Path: ${issue.path.join('.')} - ${issue.message}`)
        })
      }
      
      // Now this should pass with updated schemas
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.qaProfile.autoRefresh).toBe(true)
        expect(result.data.ticketJson.issueKey).toBe('EN-8775')
        expect(result.data.ticketJson.status).toBe('Done')
      }
    })

    it('should validate individual QA profile with real data', () => {
      const result = qaProfileSchema.safeParse(realExampleData.qaProfile)
      
      if (!result.success) {
        console.log('QA Profile validation errors:')
        result.error.issues.forEach((issue, index) => {
          console.log(`${index + 1}. Path: ${issue.path.join('.')} - ${issue.message}`)
        })
      }
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.operationMode).toBe('offline')
        expect(result.data.testCaseFormat).toBe('gherkin')
        expect(result.data.qaCategories.functional).toBe(true)
      }
    })

    it('should validate individual Jira ticket with real data', () => {
      const result = jiraTicketSchema.safeParse(realExampleData.ticketJson)
      
      if (!result.success) {
        console.log('Jira Ticket validation errors:')
        result.error.issues.forEach((issue, index) => {
          console.log(`${index + 1}. Path: ${issue.path.join('.')} - ${issue.message}`)
        })
      }
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issueKey).toBe('EN-8775')
        expect(result.data.attachments).toHaveLength(1)
        expect(result.data.comments).toHaveLength(1)
        expect(result.data.components).toContain('Accounts Receivable')
      }
    })
  })

  describe('QA Profile Structure Analysis', () => {
    it('should identify extra fields in real QA profile', () => {
      const realQAProfile = realExampleData.qaProfile
      const expectedFields = ['qaCategories', 'testCaseFormat']
      const actualFields = Object.keys(realQAProfile)
      
      const extraFields = actualFields.filter(field => !expectedFields.includes(field))
      
      console.log('Extra fields in real QA profile:', extraFields)
      expect(extraFields.length).toBeGreaterThan(0)
      expect(extraFields).toContain('autoRefresh')
      expect(extraFields).toContain('includeComments')
      expect(extraFields).toContain('includeImages')
      expect(extraFields).toContain('operationMode')
      expect(extraFields).toContain('showNotifications')
    })
  })

  describe('Jira Ticket Structure Analysis', () => {
    it('should identify missing required fields in real ticket', () => {
      const realTicket = realExampleData.ticketJson
      
      // Fields that our schema requires but might not be in real data
      const requiredFields = [
        'key', 'summary', 'description', 'status', 'priority', 'issueType', 
        'reporter', 'created', 'updated', 'scrapedAt', 'jiraUrl'
      ]
      
      const actualFields = Object.keys(realTicket)
      const missingFields = requiredFields.filter(field => !actualFields.includes(field))
      
      console.log('Missing required fields in real ticket:', missingFields)
      console.log('Extra fields in real ticket:', actualFields.filter(field => !requiredFields.includes(field)))
      
      // The real data has different field names/structure
      expect(actualFields).toContain('issueKey') // instead of 'key'
      expect(actualFields).toContain('summary')
      expect(actualFields).toContain('description')
    })

    it('should analyze attachment structure differences', () => {
      const realAttachment = realExampleData.ticketJson.attachments[0]
      const realAttachmentFields = Object.keys(realAttachment)
      
      console.log('Real attachment fields:', realAttachmentFields)
      
      // Real structure has different fields than our schema
      expect(realAttachmentFields).toContain('data')
      expect(realAttachmentFields).toContain('mime')
      expect(realAttachmentFields).toContain('name')
      expect(realAttachmentFields).toContain('size')
      expect(realAttachmentFields).toContain('tooBig')
      expect(realAttachmentFields).toContain('url')
    })

    it('should analyze comment structure differences', () => {
      const realComment = realExampleData.ticketJson.comments[0]
      const realCommentFields = Object.keys(realComment)
      
      console.log('Real comment fields:', realCommentFields)
      
      // Real structure has different fields than our schema
      expect(realCommentFields).toContain('author')
      expect(realCommentFields).toContain('body')
      expect(realCommentFields).toContain('date') // instead of 'created'
      expect(realCommentFields).toContain('images')
      expect(realCommentFields).toContain('links')
    })
  })
})