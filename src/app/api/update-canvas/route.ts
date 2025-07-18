import { NextRequest } from 'next/server'
import { generateTextWithFailover } from '../../../lib/ai/providerFailover'
import { NextResponse } from 'next/server'
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
import {
  IntentAnalyzer,
  SectionTargetDetector,
  DependencyAnalyzer,
  ClarificationGenerator,
  ContextualResponseGenerator,
  conversationStateManager,
  generateSessionId,
  type IntentAnalysisResult,
  type IntentType,
  type CanvasSection,
  type ClarificationResult,
  type ContextualResponse,
  type ConversationState
} from '../../../lib/ai/intent'

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
  }).optional(),
  originalTicketData: z.object({
    issueKey: z.string(),
    summary: z.string(),
    description: z.string(),
    status: z.string(),
    priority: z.string(),
    issueType: z.string(),
    assignee: z.string().optional(),
    reporter: z.string(),
    comments: z.array(z.any()).default([]),
    attachments: z.array(z.any()).default([]),
    components: z.array(z.string()).default([]),
    customFields: z.record(z.string(), z.any()).default({}),
    scrapedAt: z.string()
  }).optional().describe('Original Jira ticket data for context and reference')
})

type UpdateCanvasPayload = z.infer<typeof updateCanvasPayloadSchema>

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * POST /api/update-canvas
 * Handles conversational refinement of QA documentation through streaming responses with intent analysis
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

    const { messages, currentDocument, originalTicketData }: UpdateCanvasPayload = validationResult.data

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
    
    // Get the latest user message for intent analysis
    const latestUserMessage = sanitizedMessages.filter(msg => msg.role === 'user').pop()
    
    if (!latestUserMessage) {
      return handleValidationError([{
        path: ['messages'],
        message: 'No user message found',
        code: 'invalid_format'
      }], requestId)
    }

    // Initialize intent analysis components
    const intentAnalyzer = new IntentAnalyzer()
    const clarificationGenerator = new ClarificationGenerator()
    const contextualResponseGenerator = new ContextualResponseGenerator()
    
    // Generate or retrieve session ID for conversation state management
    const sessionId = generateSessionId()
    
    try {
      // Perform intent analysis
      const intentResult = await intentAnalyzer.analyzeIntent(
        latestUserMessage.content,
        sanitizedMessages,
        currentDocument as any
      )

      // Handle different intent types with appropriate responses
      switch (intentResult.intent) {
        case 'ask_clarification':
          return await handleClarificationIntent(
            intentResult,
            latestUserMessage.content,
            currentDocument,
            clarificationGenerator,
            sessionId,
            requestId
          )

        case 'provide_information':
        case 'request_explanation':
          return await handleInformationIntent(
            intentResult,
            latestUserMessage.content,
            currentDocument,
            originalTicketData,
            contextualResponseGenerator,
            requestId
          )

        case 'off_topic':
          return await handleOffTopicIntent(requestId)

        case 'modify_canvas':
          // Continue with canvas modification logic
          return await handleCanvasModificationIntent(
            intentResult,
            sanitizedMessages,
            currentDocument,
            originalTicketData,
            requestId
          )

        default:
          // Fallback to original logic for unknown intents
          console.warn(`Unknown intent type: ${intentResult.intent}, falling back to original logic`)
          break
      }
    } catch (intentError) {
      console.error('Intent analysis failed:', intentError)
      // Fall back to original logic if intent analysis fails
    }

    // Original logic as fallback (existing implementation)
    return await handleOriginalLogic(
      sanitizedMessages,
      currentDocument,
      originalTicketData,
      requestId
    )

  } catch (error) {
    return handleAIError(error, requestId)
  }
}

/**
 * Handle clarification intent - generate clarification questions
 */
async function handleClarificationIntent(
  intentResult: IntentAnalysisResult,
  userMessage: string,
  currentDocument: UpdateCanvasPayload['currentDocument'],
  clarificationGenerator: ClarificationGenerator,
  sessionId: string,
  requestId: string
): Promise<NextResponse> {
  try {
    const clarificationResult = await clarificationGenerator.generateClarificationQuestions(
      userMessage,
      intentResult.targetSections,
      currentDocument as any
    )

    // Update conversation state
    await conversationStateManager.updateState(sessionId, {
      currentPhase: 'awaiting_clarification',
      pendingClarifications: clarificationResult.questions,
      lastIntent: intentResult,
      awaitingResponse: true
    })

    return NextResponse.json({
      type: 'clarification',
      questions: clarificationResult.questions,
      context: clarificationResult.context,
      suggestedActions: clarificationResult.suggestedActions,
      sessionId,
      changesSummary: `I need some clarification to better understand your request. ${clarificationResult.context}`
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  } catch (error) {
    console.error('Clarification generation failed:', error)
    return handleAIError(error, requestId)
  }
}

/**
 * Handle information intent - provide contextual information without modification
 */
async function handleInformationIntent(
  intentResult: IntentAnalysisResult,
  userMessage: string,
  currentDocument: UpdateCanvasPayload['currentDocument'],
  originalTicketData: UpdateCanvasPayload['originalTicketData'],
  contextualResponseGenerator: ContextualResponseGenerator,
  requestId: string
): Promise<NextResponse> {
  try {
    const contextualResponse = await contextualResponseGenerator.generateContextualResponse(
      userMessage,
      currentDocument as any,
      originalTicketData as any
    )

    return NextResponse.json({
      type: 'information',
      response: contextualResponse.response,
      relevantSections: contextualResponse.relevantSections,
      citations: contextualResponse.citations,
      suggestedFollowUps: contextualResponse.suggestedFollowUps,
      changesSummary: contextualResponse.response
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  } catch (error) {
    console.error('Contextual response generation failed:', error)
    return handleAIError(error, requestId)
  }
}

/**
 * Handle off-topic intent - politely reject non-QA related queries
 */
async function handleOffTopicIntent(requestId: string): Promise<NextResponse> {
  const rejectionMessage = "I'm designed to help with QA documentation and testing-related questions for your Jira tickets. I can assist you with:\n\n" +
    "• Refining acceptance criteria\n" +
    "• Improving test cases\n" +
    "• Clarifying requirements\n" +
    "• Suggesting testing strategies\n" +
    "• Explaining QA best practices\n\n" +
    "Is there something specific about this ticket's QA documentation I can help you with?"

  return NextResponse.json({
    type: 'rejection',
    changesSummary: rejectionMessage
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}

/**
 * Handle canvas modification intent - process with dependency analysis
 */
async function handleCanvasModificationIntent(
  intentResult: IntentAnalysisResult,
  sanitizedMessages: UIMessage[],
  currentDocument: UpdateCanvasPayload['currentDocument'],
  originalTicketData: UpdateCanvasPayload['originalTicketData'],
  requestId: string
): Promise<NextResponse> {
  try {
    // Initialize dependency analyzer
    const dependencyAnalyzer = new DependencyAnalyzer()
    
    // Analyze dependencies for the target sections
    const dependencyResult = await dependencyAnalyzer.analyzeDependencies(
      intentResult.targetSections,
      currentDocument as any,
      sanitizedMessages[sanitizedMessages.length - 1].content
    )

    // If cascade is required, inform the user about affected sections
    if (dependencyResult.cascadeRequired) {
      console.log(`Dependency cascade detected for sections: ${dependencyResult.affectedSections.join(', ')}`)
    }

    // Continue with enhanced canvas modification using original logic but with intent context
    return await handleOriginalLogicWithIntent(
      sanitizedMessages,
      currentDocument,
      originalTicketData,
      intentResult,
      dependencyResult,
      requestId
    )
  } catch (error) {
    console.error('Canvas modification with intent analysis failed:', error)
    // Fall back to original logic
    return await handleOriginalLogic(sanitizedMessages, currentDocument, originalTicketData, requestId)
  }
}

/**
 * Enhanced original logic with intent context
 */
async function handleOriginalLogicWithIntent(
  sanitizedMessages: UIMessage[],
  currentDocument: UpdateCanvasPayload['currentDocument'],
  originalTicketData: UpdateCanvasPayload['originalTicketData'],
  intentResult: IntentAnalysisResult,
  dependencyResult: any,
  requestId: string
): Promise<NextResponse> {
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

  // Add intent analysis context to the prompt
  const intentEnhancedPrompt = `${enhancedSystemPrompt}

## Intent Analysis Context:

Based on my analysis of your message, I detected:
- **Intent**: ${intentResult.intent}
- **Confidence**: ${(intentResult.confidence * 100).toFixed(1)}%
- **Target Sections**: ${intentResult.targetSections.join(', ')}
- **Reasoning**: ${intentResult.reasoning}

${dependencyResult.cascadeRequired ? `
## Dependency Analysis:

I've detected that changes to ${intentResult.targetSections.join(', ')} may affect other sections:
- **Affected Sections**: ${dependencyResult.affectedSections.join(', ')}
- **Impact Assessment**: ${dependencyResult.impactAssessment}

I'll ensure all related sections remain consistent with your changes.
` : ''}
`

  // Generate updated QA document with structured output using the enhanced prompt
  return await generateCanvasUpdate(
    intentEnhancedPrompt,
    modelMessages,
    currentDocument,
    originalTicketData,
    requestId
  )
}

/**
 * Original logic fallback - handles requests without intent analysis
 */
async function handleOriginalLogic(
  sanitizedMessages: UIMessage[],
  currentDocument: UpdateCanvasPayload['currentDocument'],
  originalTicketData: UpdateCanvasPayload['originalTicketData'],
  requestId: string
): Promise<NextResponse> {
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
  const modelMessages = sanitizedMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
    createdAt: typeof msg.createdAt === 'string' ? new Date(msg.createdAt) : msg.createdAt
  }))

  // Generate updated QA document with structured output
  return await generateCanvasUpdate(
    systemPrompt,
    modelMessages,
    currentDocument,
    originalTicketData,
    requestId
  )
}

/**
 * Generate canvas update with AI
 */
async function generateCanvasUpdate(
  systemPrompt: string,
  modelMessages: any[],
  currentDocument: UpdateCanvasPayload['currentDocument'],
  originalTicketData: UpdateCanvasPayload['originalTicketData'],
  requestId: string
): Promise<NextResponse> {
  // Check for ambiguities in the latest user message
  const latestUserMessage = modelMessages.filter(msg => msg.role === 'user').pop()

  // Document any assumptions we need to make
  let assumptions: any[] = []
  if (latestUserMessage && currentDocument) {
    const context: SystemPromptContext = {
      currentDocument: currentDocument as any,
      conversationHistory: modelMessages as UIMessage[]
    }
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

  const updatePrompt = `You are a QA analyst helping to refine and improve QA documentation based on user feedback.

ORIGINAL JIRA TICKET DATA (for reference and context):
${originalTicketData ? `
**TICKET INFORMATION:**
- Issue Key: ${originalTicketData.issueKey}
- Summary: ${originalTicketData.summary}
- Type: ${originalTicketData.issueType}
- Priority: ${originalTicketData.priority}
- Status: ${originalTicketData.status}
- Assignee: ${originalTicketData.assignee || 'Unassigned'}
- Reporter: ${originalTicketData.reporter}

**DESCRIPTION:**
${originalTicketData.description}

**COMPONENTS:**
${originalTicketData.components.length > 0 ? originalTicketData.components.join(', ') : 'None specified'}

**CUSTOM FIELDS:**
${Object.entries(originalTicketData.customFields).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

**COMMENTS (${originalTicketData.comments.length} total) - READ EVERY WORD:**
${originalTicketData.comments.map((comment: any, index: number) =>
      `${index + 1}. ${comment.author} (${comment.date}): ${comment.body}`
    ).join('\n')}

**ATTACHMENTS:**
${originalTicketData.attachments.length > 0 ?
          originalTicketData.attachments.map((att: any) => `- ${att.name} (${att.mime})`).join('\n') :
          'No attachments'}
` : 'No original ticket data provided'}

CURRENT DOCUMENT:
${currentDocument ? JSON.stringify(currentDocument, null, 2) : 'No current document provided'}

CONVERSATION HISTORY:
${modelMessages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

🎯 INTELLIGENT ANALYSIS INSTRUCTIONS:

**PRIMARY DIRECTIVE**: The user's message is your most important instruction. Listen carefully to what they're telling you.

**COMPREHENSIVE RE-ANALYSIS APPROACH**:
When a user corrects you or points out an error, you must:

1. **ACKNOWLEDGE THE CORRECTION**: Accept that you may have misunderstood something
2. **RE-EXAMINE ALL DATA**: Look at the original ticket data with fresh eyes
3. **TRACE THE EVOLUTION**: Follow the chronological progression in comments to understand the current state
4. **SYNTHESIZE INTELLIGENTLY**: Determine what is actually being implemented based on the complete picture

**DEEP UNDERSTANDING METHODOLOGY**:
- **Historical Context**: What was the original problem and its background?
- **Development Journey**: How has the approach evolved through the comments?
- **Current Implementation**: What are developers actually building right now?
- **Scope Recognition**: Is this a complete fix, partial solution, diagnostic work, or something else?

**INTELLIGENT RESPONSE FRAMEWORK**:
Your changesSummary should demonstrate:
1. **What you initially misunderstood** and why
2. **What new insights you gained** from re-analyzing the data
3. **How this changes the documentation** to be more accurate
4. **Direct response** to the user's specific concern or correction

**DOCUMENTATION ACCURACY**:
Ensure your updated document reflects:
- The actual work being performed (not assumptions)
- The current phase of the resolution process
- The specific deliverables mentioned in recent communications
- Appropriate test strategies for what's actually being built

Generate a JSON response with this EXACT structure:
{
  "updatedDocument": {
    "ticketSummary": {
      "problem": "string",
      "solution": "string", 
      "context": "string"
    },
    "configurationWarnings": [],
    "acceptanceCriteria": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "priority": "must|should|could",
        "category": "functional|ui|ux|performance|security|accessibility|api|database|negative|mobile",
        "testable": true
      }
    ],
    "testCases": [
      {
        "format": "gherkin",
        "id": "string",
        "category": "string",
        "priority": "high|medium|low",
        "estimatedTime": "string",
        "testCase": {
          "scenario": "string",
          "given": ["string"],
          "when": ["string"],
          "then": ["string"],
          "tags": ["string"]
        }
      }
    ],
    "metadata": {
      "ticketId": "string",
      "qaProfile": {},
      "generatedAt": "string"
    }
  },
  "changesSummary": "Direct response to user explaining what you understood from their message and what you corrected"
}

Return ONLY the JSON object with the updated document structure.`

  const result = await generateTextWithFailover(updatePrompt, {
    temperature: 0.1,
    maxTokens: 4000,
  })

  // Parse the AI response
  let parsedResult
  try {
    let cleanedText = result.text.trim()

    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json\s*/, '').replace(/```\s*$/, '')

    // Find JSON content
    const jsonStart = cleanedText.indexOf('{')
    const jsonEnd = cleanedText.lastIndexOf('}')

    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1)
    }

    parsedResult = JSON.parse(cleanedText)

    // Ensure we have the expected structure
    if (!parsedResult.updatedDocument) {
      throw new Error('Missing updatedDocument in response')
    }

  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError)
    console.error('Raw response:', result.text)

    return NextResponse.json(
      {
        error: 'AI_PARSING_ERROR',
        message: 'Failed to parse AI response as structured document',
        details: 'The AI returned an invalid response format'
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    )
  }

  // Return the structured response
  return NextResponse.json(parsedResult, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
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