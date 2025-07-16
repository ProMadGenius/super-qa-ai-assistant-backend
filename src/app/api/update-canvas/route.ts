import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { handleAIError, handleValidationError } from '../../../lib/ai/errorHandler'
import { 
  transformMessagesForAI, 
  buildContextAwarePrompt,
  extractConversationIntent,
  validateUIMessageFormat,
  sanitizeMessagesForAI,
  UIMessage,
  SystemPromptContext
} from '../../../lib/ai/messageTransformer'

/**
 * Schema for update canvas request payload
 */
const updateCanvasPayloadSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    createdAt: z.string().optional()
  })).min(1, 'At least one message is required'),
  currentDocument: z.object({
    ticketSummary: z.object({
      problem: z.string(),
      solution: z.string(),
      context: z.string()
    }),
    configurationWarnings: z.array(z.any()).optional(),
    acceptanceCriteria: z.array(z.any()),
    testCases: z.array(z.any()),
    metadata: z.object({
      ticketId: z.string(),
      qaProfile: z.any(),
      generatedAt: z.string()
    })
  }).optional()
})

type UpdateCanvasPayload = z.infer<typeof updateCanvasPayloadSchema>

/**
 * POST /api/update-canvas
 * Handles conversational refinement of QA documentation through streaming responses
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json()
    const validationResult = updateCanvasPayloadSchema.safeParse(body)
    
    if (!validationResult.success) {
      return handleValidationError(validationResult.error.issues)
    }

    const { messages, currentDocument }: UpdateCanvasPayload = validationResult.data

    // Validate UI message format
    const messageValidation = validateUIMessageFormat(messages)
    if (!messageValidation.valid) {
      return handleValidationError(messageValidation.errors.map(error => ({
        path: ['messages'],
        message: error,
        code: 'invalid_format'
      })))
    }

    // Sanitize messages for AI processing
    const sanitizedMessages = sanitizeMessagesForAI(messages as UIMessage[])

    // Extract conversation intent for better context
    const conversationIntent = extractConversationIntent(sanitizedMessages)

    // Build enhanced context for message transformation
    const context: SystemPromptContext = {
      currentDocument: currentDocument as any,
      conversationHistory: sanitizedMessages,
      userPreferences: currentDocument?.metadata.qaProfile ? {
        testCaseFormat: currentDocument.metadata.qaProfile.testCaseFormat,
        focusAreas: Object.entries(currentDocument.metadata.qaProfile.qaCategories || {})
          .filter(([_, active]) => active)
          .map(([category]) => category)
      } : undefined
    }

    // Build context-aware system prompt
    const systemPrompt = buildContextAwarePrompt(sanitizedMessages, context, conversationIntent)

    // Transform messages for AI processing
    // Note: As of AI SDK v5, we don't need to use convertToCoreMessages anymore
    // as the SDK automatically converts messages to the CoreMessage format
    const modelMessages = sanitizedMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      createdAt: typeof msg.createdAt === 'string' ? new Date(msg.createdAt) : msg.createdAt
    }))

    // Stream the AI response for real-time updates
    const result = await streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: modelMessages, // Use the transformed messages directly
      temperature: 0.3,
      maxTokens: 4000,
    })

    // Return streaming response compatible with useChat hook
    return result.toDataStreamResponse()

  } catch (error) {
    return handleAIError(error)
  }
}

/**
 * Build system prompt with current document context
 */
function buildSystemPrompt(currentDocument?: UpdateCanvasPayload['currentDocument']): string {
  const basePrompt = `You are a QA analyst assistant helping to refine and improve QA documentation. Your role is to:

1. **Understand user requests** for changes to QA documentation
2. **Provide helpful suggestions** for improving test coverage and quality
3. **Generate updated content** when users request specific changes
4. **Maintain consistency** with existing document structure and style
5. **Ask clarifying questions** when user requests are ambiguous

## Response Guidelines:

- **Be conversational and helpful** - respond naturally to user questions and requests
- **Provide specific, actionable advice** rather than generic suggestions
- **When generating new content**, ensure it follows the same format and quality as existing content
- **If you need clarification**, ask specific questions to better understand the user's needs
- **Maintain document coherence** - ensure any changes fit well with the existing content

## Current Conversation Context:

You are helping the user refine QA documentation for a specific Jira ticket. The user may ask you to:
- Add new test cases or acceptance criteria
- Modify existing content for clarity or completeness
- Suggest improvements to test coverage
- Help with specific testing scenarios or edge cases
- Clarify requirements or acceptance criteria`

  // Add current document context if available
  if (currentDocument) {
    const documentContext = `

## Current Document Context:

**Ticket ID:** ${currentDocument.metadata.ticketId}
**Generated:** ${currentDocument.metadata.generatedAt}

**Current Problem Statement:** ${currentDocument.ticketSummary.problem}
**Current Solution:** ${currentDocument.ticketSummary.solution}
**Context:** ${currentDocument.ticketSummary.context}

**Current Acceptance Criteria Count:** ${currentDocument.acceptanceCriteria.length}
**Current Test Cases Count:** ${currentDocument.testCases.length}

${currentDocument.configurationWarnings && currentDocument.configurationWarnings.length > 0 
  ? `**Active Warnings:** ${currentDocument.configurationWarnings.length} configuration warnings present`
  : '**No Configuration Warnings**'
}

When the user requests changes, consider how they fit with this existing content and maintain consistency.`

    return basePrompt + documentContext
  }

  return basePrompt
}

/**
 * Validate message format for UI compatibility
 */
function validateMessageFormat(messages: any[]): boolean {
  return messages.every(message => 
    message.id && 
    message.role && 
    ['user', 'assistant', 'system'].includes(message.role) &&
    typeof message.content === 'string'
  )
}