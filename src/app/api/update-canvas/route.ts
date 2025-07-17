import { NextRequest } from 'next/server'
import { streamTextWithFailover } from '../../../lib/ai/providerFailover'
import { z } from 'zod'
import { handleAIError, handleValidationError } from '../../../lib/ai/errorHandler'
import { 
  buildContextAwarePrompt,
  extractConversationIntent,
  sanitizeMessagesForAI,
  UIMessage,
  SystemPromptContext
} from '../../../lib/ai/messageTransformer'
import {
  documentAssumptionsDetailed
} from '../../../lib/ai/uncertaintyHandler'
import { v4 as uuidv4 } from 'uuid'

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
  // Generate a unique request ID for tracking and debugging
  const requestId = uuidv4()
  
  try {
    // Parse and validate the request body
    const body = await request.json()
    const validationResult = updateCanvasPayloadSchema.safeParse(body)
    
    if (!validationResult.success) {
      return handleValidationError(validationResult.error.issues, requestId)
    }

    const { messages, currentDocument }: UpdateCanvasPayload = validationResult.data

    // Validate message format
    if (!validateMessageFormat(messages)) {
      return handleValidationError([{
        path: ['messages'],
        message: 'Invalid message format',
        code: 'invalid_format'
      }], requestId)
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

    // Check for ambiguities in the latest user message
    const latestUserMessage = sanitizedMessages.filter(msg => msg.role === 'user').pop()
    
    // Document any assumptions we need to make
    let assumptions: any[] = []
    if (latestUserMessage) {
      assumptions = documentAssumptionsDetailed(latestUserMessage, context)
    }
    
    // Enhance system prompt with uncertainty handling instructions if needed
    let enhancedSystemPrompt = systemPrompt
    if (assumptions.length > 0) {
      enhancedSystemPrompt = `${systemPrompt}

## Uncertainty Handling Instructions:

I've detected some ambiguity in the user's request. Please follow these guidelines:

1. If the request is unclear, use the "try, verify, and ask for feedback" approach:
   - Make your best attempt to address what you think the user is asking
   - Clearly state any assumptions you're making
   - Ask specific questions to clarify ambiguous points

2. When making assumptions:
   - Explicitly state what you're assuming and why
   - Offer alternatives if appropriate
   - Ask for confirmation or correction

3. For ambiguous requests:
   - Provide a response that addresses the most likely interpretation
   - Acknowledge other possible interpretations
   - Ask clarifying questions to narrow down the user's intent

4. Always maintain a conversational, helpful tone while being transparent about uncertainty.

Specific assumptions detected in this request:
${assumptions.map(a => `- ${a.description}`).join('\n')}
`
    }

    // Stream the AI response for real-time updates with failover
    // Convert messages to a single prompt format since streamTextWithFailover expects a prompt
    const conversationPrompt = [
      enhancedSystemPrompt,
      ...modelMessages.map(msg => `${msg.role}: ${msg.content}`)
    ].join('\n\n')

    const result = await streamTextWithFailover(
      conversationPrompt,
      {
        temperature: 0.3,
        maxTokens: 4000,
      }
    )

    // Return streaming response compatible with useChat hook
    return result.toDataStreamResponse()

  } catch (error) {
    return handleAIError(error, requestId)
  }
}

/**
 * Build system prompt with current document context
 */
function _buildSystemPrompt(currentDocument?: UpdateCanvasPayload['currentDocument']): string {
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