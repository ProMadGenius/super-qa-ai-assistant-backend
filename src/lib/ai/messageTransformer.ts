/**
 * Message Transformation Pipeline
 * Handles conversion between UI messages and AI model messages
 */

import { convertToModelMessages } from 'ai'
import { QACanvasDocument } from '../schemas/QACanvasDocument'

/**
 * UI Message structure (from useChat hook)
 */
export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  metadata?: Record<string, any>
}

/**
 * Enhanced system prompt context
 */
export interface SystemPromptContext {
  currentDocument?: QACanvasDocument
  conversationHistory?: UIMessage[]
  userPreferences?: {
    testCaseFormat?: 'gherkin' | 'steps' | 'table'
    focusAreas?: string[]
  }
}

/**
 * Transform UI messages to model messages with enhanced context
 */
export function transformMessagesForAI(
  messages: UIMessage[],
  context?: SystemPromptContext
): any[] {
  // Filter out system messages that should be handled separately
  const userAndAssistantMessages = messages.filter(msg => msg.role !== 'system')
  
  // Convert to model messages using Vercel AI SDK
  const modelMessages = convertToModelMessages(userAndAssistantMessages)
  
  // Add enhanced context if provided
  if (context) {
    // Prepend system message with context
    const systemMessage = buildEnhancedSystemMessage(context)
    return [systemMessage, ...modelMessages]
  }
  
  return modelMessages
}

/**
 * Build enhanced system message with context
 */
export function buildEnhancedSystemMessage(context: SystemPromptContext): any {
  let systemContent = buildBaseSystemPrompt()
  
  // Add document context
  if (context.currentDocument) {
    systemContent += buildDocumentContext(context.currentDocument)
  }
  
  // Add conversation context
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    systemContent += buildConversationContext(context.conversationHistory)
  }
  
  // Add user preferences
  if (context.userPreferences) {
    systemContent += buildUserPreferencesContext(context.userPreferences)
  }
  
  return {
    role: 'system',
    content: systemContent
  }
}

/**
 * Build base system prompt for QA refinement
 */
function buildBaseSystemPrompt(): string {
  return `You are a QA analyst assistant helping to refine and improve QA documentation. Your role is to:

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
- **Focus on practical implementation** - provide test cases and criteria that can be executed
- **Consider edge cases** - suggest scenarios that might not be obvious but are important to test

## Current Conversation Context:

You are helping the user refine QA documentation for a specific Jira ticket. The user may ask you to:
- Add new test cases or acceptance criteria
- Modify existing content for clarity or completeness
- Suggest improvements to test coverage
- Help with specific testing scenarios or edge cases
- Clarify requirements or acceptance criteria
- Convert between different test case formats (Gherkin, steps, table)
- Identify gaps in current test coverage`
}

/**
 * Build document context section
 */
function buildDocumentContext(document: QACanvasDocument): string {
  const warningsText = document.configurationWarnings && document.configurationWarnings.length > 0
    ? `**Active Warnings:** ${document.configurationWarnings.length} configuration warnings present`
    : '**No Configuration Warnings**'

  return `

## Current Document Context:

**Ticket ID:** ${document.metadata.ticketId}
**Generated:** ${document.metadata.generatedAt}
**Test Case Format:** ${document.metadata.qaProfile?.testCaseFormat || 'Not specified'}

**Current Problem Statement:** ${document.ticketSummary.problem}
**Current Solution:** ${document.ticketSummary.solution}
**Context:** ${document.ticketSummary.context}

**Current Acceptance Criteria Count:** ${document.acceptanceCriteria.length}
**Current Test Cases Count:** ${document.testCases.length}

${warningsText}

**Active QA Categories:** ${document.metadata.qaProfile ? 
  Object.entries(document.metadata.qaProfile.qaCategories || {})
    .filter(([_, active]) => active)
    .map(([category]) => category)
    .join(', ') || 'None specified'
  : 'Not specified'}

When the user requests changes, consider how they fit with this existing content and maintain consistency.`
}

/**
 * Build conversation context section
 */
function buildConversationContext(history: UIMessage[]): string {
  const recentMessages = history.slice(-5) // Last 5 messages for context
  const conversationSummary = recentMessages
    .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
    .join('\n')

  return `

## Recent Conversation Context:

${conversationSummary}

Consider this conversation history when responding to maintain continuity and avoid repeating information.`
}

/**
 * Build user preferences context
 */
function buildUserPreferencesContext(preferences: SystemPromptContext['userPreferences']): string {
  let preferencesText = '\n\n## User Preferences:\n\n'
  
  if (preferences?.testCaseFormat) {
    preferencesText += `**Preferred Test Case Format:** ${preferences.testCaseFormat}\n`
  }
  
  if (preferences?.focusAreas && preferences.focusAreas.length > 0) {
    preferencesText += `**Focus Areas:** ${preferences.focusAreas.join(', ')}\n`
  }
  
  preferencesText += '\nEnsure your responses align with these preferences when possible.'
  
  return preferencesText
}

/**
 * Validate message format for UI compatibility
 */
export function validateUIMessageFormat(messages: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!Array.isArray(messages)) {
    errors.push('Messages must be an array')
    return { valid: false, errors }
  }
  
  messages.forEach((message, index) => {
    if (!message.id) {
      errors.push(`Message ${index} is missing required 'id' field`)
    }
    
    if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
      errors.push(`Message ${index} has invalid 'role' field. Must be 'user', 'assistant', or 'system'`)
    }
    
    if (typeof message.content !== 'string') {
      errors.push(`Message ${index} has invalid 'content' field. Must be a string`)
    }
    
    if (message.createdAt && typeof message.createdAt !== 'string') {
      errors.push(`Message ${index} has invalid 'createdAt' field. Must be a string`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Sanitize messages for AI processing (remove sensitive metadata)
 */
export function sanitizeMessagesForAI(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt
    // Exclude metadata and other potentially sensitive fields
  }))
}

/**
 * Extract conversation intent from messages
 */
export function extractConversationIntent(messages: UIMessage[]): {
  intent: 'add_content' | 'modify_content' | 'ask_question' | 'general_help' | 'unknown'
  confidence: number
  details?: string
} {
  if (messages.length === 0) {
    return { intent: 'unknown', confidence: 0 }
  }
  
  const lastUserMessage = messages
    .filter(msg => msg.role === 'user')
    .pop()
  
  if (!lastUserMessage) {
    return { intent: 'unknown', confidence: 0 }
  }
  
  const content = lastUserMessage.content.toLowerCase()
  
  // Intent detection patterns - order matters for priority
  const modifyPatterns = ['update', 'change', 'modify', 'edit', 'fix', 'revise', 'existing']
  const addPatterns = ['add', 'create', 'generate', 'new', 'more', 'additional']
  const questionPatterns = ['what', 'how', 'why', 'when', 'where', '?']
  const helpPatterns = ['help', 'assist', 'guide', 'explain', 'show me', 'improve']
  
  // Check for modify content intent first (more specific)
  if (modifyPatterns.some(pattern => content.includes(pattern))) {
    return {
      intent: 'modify_content',
      confidence: 0.8,
      details: 'User wants to modify existing content'
    }
  }
  
  // Check for add content intent
  if (addPatterns.some(pattern => content.includes(pattern))) {
    return {
      intent: 'add_content',
      confidence: 0.8,
      details: 'User wants to add new content to the document'
    }
  }
  
  // Check for question intent
  if (questionPatterns.some(pattern => content.includes(pattern))) {
    return {
      intent: 'ask_question',
      confidence: 0.7,
      details: 'User is asking a question'
    }
  }
  
  // Check for help intent (check this last as it's most general)
  if (helpPatterns.some(pattern => content.includes(pattern))) {
    return {
      intent: 'general_help',
      confidence: 0.6,
      details: 'User is seeking general help or guidance'
    }
  }
  
  return {
    intent: 'unknown',
    confidence: 0.3,
    details: 'Could not determine user intent from message'
  }
}

/**
 * Build context-aware prompt based on conversation intent
 */
export function buildContextAwarePrompt(
  messages: UIMessage[],
  context: SystemPromptContext,
  intent?: ReturnType<typeof extractConversationIntent>
): string {
  const detectedIntent = intent || extractConversationIntent(messages)
  
  let prompt = buildBaseSystemPrompt()
  
  // Add intent-specific guidance
  switch (detectedIntent.intent) {
    case 'add_content':
      prompt += `\n\n**Current Request Context:** The user wants to add new content. Focus on:\n- Understanding what type of content they want to add\n- Ensuring new content integrates well with existing content\n- Maintaining consistent format and quality\n- Suggesting comprehensive coverage for the new content`
      break
      
    case 'modify_content':
      prompt += `\n\n**Current Request Context:** The user wants to modify existing content. Focus on:\n- Understanding what specific changes they want\n- Preserving the intent and quality of existing content\n- Ensuring modifications improve clarity and completeness\n- Maintaining document structure and consistency`
      break
      
    case 'ask_question':
      prompt += `\n\n**Current Request Context:** The user has a question. Focus on:\n- Providing clear, specific answers\n- Offering practical examples when helpful\n- Suggesting next steps or follow-up actions\n- Being educational and informative`
      break
      
    case 'general_help':
      prompt += `\n\n**Current Request Context:** The user needs general help. Focus on:\n- Understanding their specific needs\n- Providing step-by-step guidance\n- Offering multiple options when appropriate\n- Being supportive and encouraging`
      break
  }
  
  // Add document context
  if (context.currentDocument) {
    prompt += buildDocumentContext(context.currentDocument)
  }
  
  return prompt
}