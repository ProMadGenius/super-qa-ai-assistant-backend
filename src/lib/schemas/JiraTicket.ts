import { z } from 'zod'

/**
 * Schema for images within comments
 */
export const commentImageSchema = z.object({
  alt: z.string().describe('Alt text for the image'),
  filename: z.string().describe('Image filename'),
  height: z.number().describe('Image height in pixels'),
  isAttachment: z.boolean().describe('Whether this image is an attachment'),
  mimeType: z.string().describe('MIME type of the image'),
  src: z.string().describe('Image source URL'),
  title: z.string().describe('Image title'),
  width: z.number().describe('Image width in pixels')
})

/**
 * Schema for Jira ticket comments (updated to match real structure)
 */
export const jiraCommentSchema = z.object({
  author: z.string().describe('Comment author name'),
  body: z.string().describe('Comment content'),
  date: z.string().describe('Comment creation date string'),
  images: z.array(commentImageSchema).default([]).describe('Images embedded in the comment'),
  links: z.array(z.string()).default([]).describe('Links mentioned in the comment')
})

/**
 * Schema for Jira ticket attachments (updated to match real structure)
 */
export const jiraAttachmentSchema = z.object({
  data: z.string().describe('Base64 encoded attachment data'),
  mime: z.string().describe('MIME type of the attachment'),
  name: z.string().describe('Attachment filename'),
  size: z.number().describe('File size in bytes'),
  tooBig: z.boolean().describe('Whether the attachment is too big to process'),
  url: z.string().describe('Blob URL for the attachment')
})

/**
 * Schema for Jira ticket status
 */
export const jiraStatusSchema = z.object({
  name: z.string().describe('Status name (e.g., "To Do", "In Progress", "Done")'),
  category: z.string().describe('Status category (e.g., "new", "indeterminate", "done")')
})

/**
 * Schema for Jira ticket priority
 */
export const jiraPrioritySchema = z.object({
  name: z.string().describe('Priority name (e.g., "High", "Medium", "Low")'),
  id: z.string().describe('Priority ID')
})

/**
 * Schema for Jira ticket type
 */
export const jiraIssueTypeSchema = z.object({
  name: z.string().describe('Issue type name (e.g., "Bug", "Story", "Task")'),
  subtask: z.boolean().describe('Whether this is a subtask type')
})

/**
 * Schema for Jira user/assignee
 */
export const jiraUserSchema = z.object({
  displayName: z.string().describe('User display name'),
  emailAddress: z.string().email().optional().describe('User email address'),
  accountId: z.string().describe('Jira account ID')
})

/**
 * Complete Jira ticket schema (updated to match real Chrome extension data)
 * Represents the scraped data from a Jira ticket page
 */
export const jiraTicketSchema = z.object({
  // Basic ticket information (real structure uses different field names)
  issueKey: z.string().describe('Jira ticket key (e.g., "EN-8775")'),
  summary: z.string().describe('Ticket title/summary'),
  description: z.string().describe('Ticket description content'),
  
  // Ticket metadata (real data has these as strings, not objects)
  status: z.string().describe('Current ticket status as string (e.g., "Done")'),
  priority: z.string().describe('Ticket priority as string (e.g., "Priority: Normal")'),
  issueType: z.string().describe('Type of issue as string (e.g., "Bug")'),
  
  // People (real data has these as strings, not user objects)
  assignee: z.string().optional().describe('Assigned user name as string'),
  reporter: z.string().describe('User who created the ticket as string'),
  
  // Additional content
  comments: z.array(jiraCommentSchema).default([]).describe('Ticket comments'),
  attachments: z.array(jiraAttachmentSchema).default([]).describe('Ticket attachments'),
  
  // Real data specific fields
  components: z.array(z.string()).default([]).describe('Jira components (e.g., ["Accounts Receivable"])'),
  customFields: z.record(z.string(), z.any()).describe('Custom fields from Jira'),
  processingComplete: z.boolean().optional().describe('Whether processing is complete'),
  
  // Metadata about the scraping
  scrapedAt: z.string().describe('Timestamp when data was scraped')
})

// Type exports for TypeScript usage
export type CommentImage = z.infer<typeof commentImageSchema>
export type JiraComment = z.infer<typeof jiraCommentSchema>
export type JiraAttachment = z.infer<typeof jiraAttachmentSchema>
export type JiraStatus = z.infer<typeof jiraStatusSchema>
export type JiraPriority = z.infer<typeof jiraPrioritySchema>
export type JiraIssueType = z.infer<typeof jiraIssueTypeSchema>
export type JiraUser = z.infer<typeof jiraUserSchema>
export type JiraTicket = z.infer<typeof jiraTicketSchema>