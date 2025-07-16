import { validateTicketAnalysisPayload } from '@/lib/schemas/TicketAnalysisPayload'

describe('Complete Real Data Integration Test', () => {
  // Complete real example from EN-8775-full.json
  const completeRealData = {
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
        },
        {
          "data": "base64string...",
          "mime": "text/csv",
          "name": "EN-8775 Possible dups.csv",
          "size": 28864,
          "tooBig": false,
          "url": "blob:https://amtech.atlassian.net/ee9eb30c-5747-4049-afdf-ab206bccab76"
        },
        {
          "data": "base64string...",
          "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "name": "BOA OUTPUT files.xlsx",
          "size": 13442,
          "tooBig": false,
          "url": "blob:https://amtech.atlassian.net/ead9e4d5-e6a1-4764-8eac-24913d43f3c9"
        }
      ],
      "comments": [
        {
          "author": "Lisa Thomas",
          "body": "@Fred Solovyev I would rather not close this out for now… I'd like to keep it open. I think it would be helpful if we set up a meeting with the customer to go over the exact transactions that need to be corrected. I will review on my own today or possibly tomorrow and let you know once I schedule something with the customer. Thanks.",
          "date": "July 14, 2025 at 8:45 AM",
          "images": [],
          "links": []
        },
        {
          "author": "Fred Solovyev",
          "body": "@Lisa Thomas, sounds good. Thanks",
          "date": "July 14, 2025 at 9:37 AM",
          "images": [],
          "links": []
        },
        {
          "author": "Fred Solovyev",
          "body": "@Lisa Thomas , I started to check invoices in the BOA file and don't see as many duplicates in S1DFW250311 db as it would be if the file was imported twice. There are 68 invoices in the file and 20 possible dups I can find. Please see the csv file attached. Also, in CASHRECEIPTS tbls there are records which look like were added manually. What do you think? Thanks cc @Gary Poindexter",
          "date": "July 3, 2025 at 3:18 PM",
          "images": [
            {
              "alt": "image-20250703-191721.png",
              "filename": "31d7a2eb-82fc-4d20-8284-7b52c49d5531",
              "height": 319,
              "isAttachment": true,
              "mimeType": "image/png",
              "src": "blob:https://amtech.atlassian.net/31d7a2eb-82fc-4d20-8284-7b52c49d5531#media-blob-url=true&id=54a2c4a0-073f-4643-9237-54e4b311cbb2&collection=&contextId=71151&width=890&height=222&alt=image-20250703-191721.png",
              "title": "",
              "width": 1280
            }
          ],
          "links": []
        }
      ],
      "components": [
        "Accounts Receivable"
      ],
      "customFields": {
        "acceptance_criteria": "Add Attachment",
        "affects_versions": "None",
        "change_log": "Description in reference to case 661432...",
        "date-inline-edit": "None",
        "fix_versions": "K2_2025.07.0.0",
        "issue_type": "Bug",
        "labels": "Regression, Rework",
        "original-estimate-inline-edit": "12h",
        "release_notes": "Description in reference to case 661432...",
        "rich-text": "ACH",
        "select": "Accounts Receivable",
        "single-line-text-inline-edit": "None",
        "steps_to_reproduce": "REWORK: Customer stated they had tested in SC1514TST...",
        "user": "Fred SolovyevFred Solovyev"
      },
      "description": "in reference to case 661432.Using a payment made from LabCorp as a reference this is what I found.Image 1 shows the ACH Payment made on 2-23-2024.LabCorp's remittance referenced the two invoices listed.These amounts were CO'd on the account as you can see in image 2.When looking at invoices 395500 and 395676 they are both closed, you can see this on images 3&4.Image 5 shows what the check details should look like on a closed invoice paid by ACH. Image 6 shows what the check details look like for both invoices.No information is given on how why or when these invoices were closed. I am unable to reverse these payments and correct them because I have no way to pull up the transaction as I have nothing to reference. There are multiple payments like this from multiple days.Open one of the referenced payments. No check data is attached the invoice yet the invoice is closed. Multiple invoices and payments credit to the accts.",
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

  describe('Full Real Data Validation', () => {
    it('should successfully validate complete real Chrome extension data', () => {
      const result = validateTicketAnalysisPayload(completeRealData)
      
      if (!result.success) {
        console.log('Validation errors for complete real data:')
        result.error.issues.forEach((issue, index) => {
          console.log(`${index + 1}. Path: ${issue.path.join('.')} - ${issue.message}`)
        })
      }
      
      expect(result.success).toBe(true)
      
      if (result.success) {
        // Validate QA Profile structure
        expect(result.data.qaProfile.autoRefresh).toBe(true)
        expect(result.data.qaProfile.operationMode).toBe('offline')
        expect(result.data.qaProfile.testCaseFormat).toBe('gherkin')
        expect(result.data.qaProfile.qaCategories.functional).toBe(true)
        expect(result.data.qaProfile.qaCategories.api).toBe(false)
        
        // Validate Jira Ticket structure
        expect(result.data.ticketJson.issueKey).toBe('EN-8775')
        expect(result.data.ticketJson.status).toBe('Done')
        expect(result.data.ticketJson.priority).toBe('Priority: Normal')
        expect(result.data.ticketJson.issueType).toBe('Bug')
        expect(result.data.ticketJson.assignee).toBe('Fred Solovyev')
        expect(result.data.ticketJson.reporter).toBe('Exalate')
        
        // Validate arrays
        expect(result.data.ticketJson.attachments).toHaveLength(3)
        expect(result.data.ticketJson.comments).toHaveLength(3)
        expect(result.data.ticketJson.components).toContain('Accounts Receivable')
        
        // Validate attachment structure
        const firstAttachment = result.data.ticketJson.attachments[0]
        expect(firstAttachment.mime).toBe('image/png')
        expect(firstAttachment.name).toBe('image-20250703-191721.png')
        expect(firstAttachment.size).toBe(145539)
        expect(firstAttachment.tooBig).toBe(false)
        expect(firstAttachment.data).toBe('base64string...')
        
        // Validate comment structure
        const firstComment = result.data.ticketJson.comments[0]
        expect(firstComment.author).toBe('Lisa Thomas')
        expect(firstComment.date).toBe('July 14, 2025 at 8:45 AM')
        expect(firstComment.images).toEqual([])
        expect(firstComment.links).toEqual([])
        
        // Validate comment with image
        const commentWithImage = result.data.ticketJson.comments[2]
        expect(commentWithImage.images).toHaveLength(1)
        expect(commentWithImage.images[0].alt).toBe('image-20250703-191721.png')
        expect(commentWithImage.images[0].width).toBe(1280)
        expect(commentWithImage.images[0].height).toBe(319)
        expect(commentWithImage.images[0].isAttachment).toBe(true)
        
        // Validate custom fields
        expect(result.data.ticketJson.customFields.acceptance_criteria).toBe('Add Attachment')
        expect(result.data.ticketJson.customFields.issue_type).toBe('Bug')
        expect(result.data.ticketJson.customFields.labels).toBe('Regression, Rework')
        expect(result.data.ticketJson.customFields.fix_versions).toBe('K2_2025.07.0.0')
        
        // Validate processing metadata
        expect(result.data.ticketJson.processingComplete).toBe(true)
        expect(result.data.ticketJson.scrapedAt).toBe('2025-07-15T23:56:47.427Z')
      }
    })

    it('should handle different attachment types correctly', () => {
      const result = validateTicketAnalysisPayload(completeRealData)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const attachments = result.data.ticketJson.attachments
        
        // PNG image
        expect(attachments[0].mime).toBe('image/png')
        expect(attachments[0].name).toBe('image-20250703-191721.png')
        
        // CSV file
        expect(attachments[1].mime).toBe('text/csv')
        expect(attachments[1].name).toBe('EN-8775 Possible dups.csv')
        
        // Excel file
        expect(attachments[2].mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        expect(attachments[2].name).toBe('BOA OUTPUT files.xlsx')
        
        // All should have required fields
        attachments.forEach((attachment, index) => {
          expect(attachment.data).toBeDefined()
          expect(attachment.size).toBeGreaterThan(0)
          expect(attachment.tooBig).toBe(false)
          expect(attachment.url).toContain('blob:https://amtech.atlassian.net/')
        })
      }
    })

    it('should validate complex custom fields structure', () => {
      const result = validateTicketAnalysisPayload(completeRealData)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const customFields = result.data.ticketJson.customFields
        
        // Should handle various field types
        expect(typeof customFields.acceptance_criteria).toBe('string')
        expect(typeof customFields['original-estimate-inline-edit']).toBe('string') // "12h"
        expect(typeof customFields.labels).toBe('string') // "Regression, Rework"
        
        // Should preserve all custom field data
        expect(Object.keys(customFields)).toContain('change_log')
        expect(Object.keys(customFields)).toContain('steps_to_reproduce')
        expect(Object.keys(customFields)).toContain('release_notes')
        expect(Object.keys(customFields)).toContain('rich-text')
        expect(Object.keys(customFields)).toContain('user')
      }
    })

    it('should validate that schema works for API endpoint consumption', () => {
      // This test ensures the data structure is ready for the /api/analyze-ticket endpoint
      const result = validateTicketAnalysisPayload(completeRealData)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const { qaProfile, ticketJson } = result.data
        
        // QA Profile should have all fields needed for AI analysis
        expect(qaProfile.qaCategories).toBeDefined()
        expect(qaProfile.testCaseFormat).toBeDefined()
        expect(qaProfile.includeComments).toBe(true) // Important for AI context
        expect(qaProfile.includeImages).toBe(true)   // Important for AI context
        
        // Ticket should have all fields needed for AI analysis
        expect(ticketJson.issueKey).toBeDefined()
        expect(ticketJson.summary).toBeDefined()
        expect(ticketJson.description).toBeDefined()
        expect(ticketJson.comments).toBeDefined()
        expect(ticketJson.attachments).toBeDefined()
        expect(ticketJson.customFields).toBeDefined()
        
        // Should have acceptance criteria in custom fields for AI to use
        expect(ticketJson.customFields.acceptance_criteria).toBeDefined()
        expect(ticketJson.customFields.steps_to_reproduce).toBeDefined()
      }
    })
  })

  describe('Edge Cases from Real Data', () => {
    it('should handle comments with @mentions and special characters', () => {
      const result = validateTicketAnalysisPayload(completeRealData)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const comments = result.data.ticketJson.comments
        
        // Should preserve @mentions
        expect(comments[0].body).toContain('@Fred Solovyev')
        expect(comments[2].body).toContain('@Lisa Thomas')
        expect(comments[2].body).toContain('@Gary Poindexter')
        
        // Should handle special characters and formatting
        expect(comments[0].body).toContain('…') // ellipsis
        // Note: The ampersand was not in the actual comment text
      }
    })

    it('should handle blob URLs correctly', () => {
      const result = validateTicketAnalysisPayload(completeRealData)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const attachments = result.data.ticketJson.attachments
        const commentImages = result.data.ticketJson.comments[2].images
        
        // All blob URLs should be preserved
        attachments.forEach(attachment => {
          expect(attachment.url).toMatch(/^blob:https:\/\//)
        })
        
        commentImages.forEach(image => {
          expect(image.src).toMatch(/^blob:https:\/\//)
        })
      }
    })

    it('should handle long text fields without truncation', () => {
      const result = validateTicketAnalysisPayload(completeRealData)
      expect(result.success).toBe(true)
      
      if (result.success) {
        const { ticketJson } = result.data
        
        // Long description should be preserved
        expect(ticketJson.description.length).toBeGreaterThan(100)
        
        // Long custom field values should be preserved
        expect(ticketJson.customFields.steps_to_reproduce.length).toBeGreaterThan(50)
        expect(ticketJson.customFields.change_log.length).toBeGreaterThan(30) // Adjusted to match actual data
        
        // Long comment bodies should be preserved
        const longComment = ticketJson.comments.find(c => c.body.length > 200)
        expect(longComment).toBeDefined()
      }
    })
  })
})