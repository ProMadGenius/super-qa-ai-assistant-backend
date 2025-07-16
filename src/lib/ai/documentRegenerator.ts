/**
 * Document Regeneration Service
 * Handles complete document recreation based on user feedback and conversation context
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { QACanvasDocument, qaCanvasDocumentSchema } from '../schemas/QACanvasDocument'
import { JiraTicket } from '../schemas/JiraTicket'
import { QAProfile } from '../schemas/QAProfile'
import { UIMessage } from './messageTransformer'

/**
 * Document regeneration context
 */
export interface RegenerationContext {
  originalDocument: QACanvasDocument
  conversationHistory: UIMessage[]
  userFeedback: string
  ticketData: JiraTicket
  qaProfile: QAProfile
}

/**
 * Regeneration options
 */
export interface RegenerationOptions {
  preserveStructure?: boolean
  focusAreas?: string[]
  regenerationMode?: 'complete' | 'incremental' | 'targeted'
  temperature?: number
  model?: string
}

/**
 * Regeneration result
 */
export interface RegenerationResult {
  document: QACanvasDocument
  changes: DocumentChange[]
  regenerationTime: number
  preservedElements: string[]
  modifiedElements: string[]
}

/**
 * Document change tracking
 */
export interface DocumentChange {
  section: 'ticketSummary' | 'acceptanceCriteria' | 'testCases' | 'configurationWarnings'
  changeType: 'added' | 'modified' | 'removed' | 'preserved'
  description: string
  oldValue?: any
  newValue?: any
}

/**
 * Default regeneration options
 */
const defaultOptions: RegenerationOptions = {
  preserveStructure: true,
  regenerationMode: 'complete',
  temperature: 0.3,
  model: 'gpt-4o'
}

/**
 * Regenerate QA document based on user feedback and conversation context
 */
export async function regenerateDocument(
  context: RegenerationContext,
  options: RegenerationOptions = {}
): Promise<RegenerationResult> {
  const startTime = Date.now()
  const mergedOptions = { ...defaultOptions, ...options }
  
  try {
    // Build regeneration prompt with context
    const regenerationPrompt = buildRegenerationPrompt(context, mergedOptions)
    
    // Generate new document using AI
    const { object: regeneratedDocument } = await generateObject({
      model: openai(mergedOptions.model!),
      schema: qaCanvasDocumentSchema,
      system: getRegenerationSystemPrompt(),
      prompt: regenerationPrompt,
      temperature: mergedOptions.temperature,
    })
    
    // Track changes between original and regenerated document
    const changes = trackDocumentChanges(context.originalDocument, regeneratedDocument)
    
    // Enhance document with updated metadata
    const enhancedDocument: QACanvasDocument = {
      ...regeneratedDocument,
      metadata: {
        ...regeneratedDocument.metadata,
        generatedAt: new Date().toISOString(),
        qaProfile: context.qaProfile,
        ticketId: context.ticketData.issueKey,
        documentVersion: incrementVersion(context.originalDocument.metadata.documentVersion || '1.0'),
        aiModel: mergedOptions.model!,
        regenerationTime: Date.now() - startTime,
        previousVersion: context.originalDocument.metadata.documentVersion || '1.0',
        regenerationReason: extractRegenerationReason(context.userFeedback)
      }
    }
    
    // Identify preserved and modified elements
    const { preservedElements, modifiedElements } = categorizeChanges(changes)
    
    return {
      document: enhancedDocument,
      changes,
      regenerationTime: Date.now() - startTime,
      preservedElements,
      modifiedElements
    }
    
  } catch (error) {
    throw new Error(`Document regeneration failed: ${error}`)
  }
}

/**
 * Build regeneration prompt with full context
 */
function buildRegenerationPrompt(
  context: RegenerationContext,
  options: RegenerationOptions
): string {
  const { originalDocument, conversationHistory, userFeedback, ticketData, qaProfile } = context
  
  // Format conversation history
  const conversationSummary = conversationHistory
    .slice(-10) // Last 10 messages for context
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n')
  
  // Format active QA categories
  const activeCategories = Object.entries(qaProfile.qaCategories)
    .filter(([_, active]) => active)
    .map(([category]) => category)
    .join(', ')
  
  return `Regenerate the QA documentation for this Jira ticket based on user feedback and conversation context.

**ORIGINAL TICKET INFORMATION:**
- Issue Key: ${ticketData.issueKey}
- Summary: ${ticketData.summary}
- Description: ${ticketData.description}
- Type: ${ticketData.issueType}
- Priority: ${ticketData.priority}
- Components: ${ticketData.components.join(', ') || 'None'}

**CURRENT DOCUMENT SUMMARY:**
- Problem: ${originalDocument.ticketSummary.problem}
- Solution: ${originalDocument.ticketSummary.solution}
- Context: ${originalDocument.ticketSummary.context}
- Acceptance Criteria Count: ${originalDocument.acceptanceCriteria.length}
- Test Cases Count: ${originalDocument.testCases.length}
- Configuration Warnings: ${originalDocument.configurationWarnings?.length || 0}

**USER FEEDBACK AND CONVERSATION CONTEXT:**
${conversationSummary}

**SPECIFIC USER REQUEST:**
${userFeedback}

**QA PROFILE SETTINGS:**
- Test Case Format: ${qaProfile.testCaseFormat}
- Active Categories: ${activeCategories}
- Include Comments: ${qaProfile.includeComments}
- Include Images: ${qaProfile.includeImages}

**REGENERATION INSTRUCTIONS:**
1. **Incorporate user feedback** - Address the specific changes or improvements requested
2. **Maintain document coherence** - Ensure all sections work together logically
3. **Preserve quality elements** - Keep high-quality content that wasn't criticized
4. **Improve based on conversation** - Use the conversation context to understand user intent
5. **Follow QA profile settings** - Ensure the regenerated content matches user preferences
6. **Maintain professional quality** - Generate comprehensive, testable, and clear documentation

${options.regenerationMode === 'targeted' 
  ? `**TARGETED REGENERATION:** Focus primarily on ${options.focusAreas?.join(', ') || 'the areas mentioned in user feedback'}`
  : '**COMPLETE REGENERATION:** Regenerate the entire document while incorporating feedback'
}

Generate a complete, improved QACanvasDocument that addresses the user's feedback while maintaining high quality and consistency.`
}

/**
 * Get system prompt for document regeneration
 */
function getRegenerationSystemPrompt(): string {
  return `You are a senior QA analyst tasked with regenerating QA documentation based on user feedback. Your role is to:

1. **Understand user feedback** and incorporate requested changes accurately
2. **Maintain document quality** while making improvements
3. **Preserve valuable content** that doesn't need changes
4. **Ensure consistency** across all document sections
5. **Generate comprehensive content** that meets professional QA standards

## Regeneration Principles:

- **User-Centric**: Address user feedback directly and completely
- **Quality-Focused**: Maintain or improve the overall quality of documentation
- **Coherent**: Ensure all sections work together logically
- **Comprehensive**: Generate complete, testable, and actionable content
- **Consistent**: Follow the specified format and style throughout
- **Professional**: Use clear, precise language appropriate for QA documentation

## Content Guidelines:

- **Ticket Summary**: Provide clear problem/solution/context that reflects any updates
- **Configuration Warnings**: Include relevant warnings based on ticket analysis
- **Acceptance Criteria**: Generate detailed, testable criteria that cover all requirements
- **Test Cases**: Create comprehensive test cases in the specified format
- **Metadata**: Include appropriate metadata for tracking and context

Always generate a complete QACanvasDocument that represents the best possible version incorporating user feedback.`
}

/**
 * Track changes between original and regenerated documents
 */
export function trackDocumentChanges(
  original: QACanvasDocument,
  regenerated: QACanvasDocument
): DocumentChange[] {
  const changes: DocumentChange[] = []
  
  // Track ticket summary changes
  if (JSON.stringify(original.ticketSummary) !== JSON.stringify(regenerated.ticketSummary)) {
    changes.push({
      section: 'ticketSummary',
      changeType: 'modified',
      description: 'Ticket summary updated based on user feedback',
      oldValue: original.ticketSummary,
      newValue: regenerated.ticketSummary
    })
  } else {
    changes.push({
      section: 'ticketSummary',
      changeType: 'preserved',
      description: 'Ticket summary preserved from original document'
    })
  }
  
  // Track acceptance criteria changes
  const originalAC = original.acceptanceCriteria.length
  const regeneratedAC = regenerated.acceptanceCriteria.length
  
  if (originalAC !== regeneratedAC) {
    changes.push({
      section: 'acceptanceCriteria',
      changeType: originalAC < regeneratedAC ? 'added' : 'modified',
      description: `Acceptance criteria count changed from ${originalAC} to ${regeneratedAC}`,
      oldValue: originalAC,
      newValue: regeneratedAC
    })
  } else {
    // Check for content changes
    const originalACContent = JSON.stringify(original.acceptanceCriteria)
    const regeneratedACContent = JSON.stringify(regenerated.acceptanceCriteria)
    
    if (originalACContent !== regeneratedACContent) {
      changes.push({
        section: 'acceptanceCriteria',
        changeType: 'modified',
        description: 'Acceptance criteria content updated',
        oldValue: original.acceptanceCriteria,
        newValue: regenerated.acceptanceCriteria
      })
    } else {
      changes.push({
        section: 'acceptanceCriteria',
        changeType: 'preserved',
        description: 'Acceptance criteria preserved from original document'
      })
    }
  }
  
  // Track test cases changes
  const originalTC = original.testCases.length
  const regeneratedTC = regenerated.testCases.length
  
  if (originalTC !== regeneratedTC) {
    changes.push({
      section: 'testCases',
      changeType: originalTC < regeneratedTC ? 'added' : 'modified',
      description: `Test cases count changed from ${originalTC} to ${regeneratedTC}`,
      oldValue: originalTC,
      newValue: regeneratedTC
    })
  } else {
    // Check for content changes
    const originalTCContent = JSON.stringify(original.testCases)
    const regeneratedTCContent = JSON.stringify(regenerated.testCases)
    
    if (originalTCContent !== regeneratedTCContent) {
      changes.push({
        section: 'testCases',
        changeType: 'modified',
        description: 'Test cases content updated',
        oldValue: original.testCases,
        newValue: regenerated.testCases
      })
    } else {
      changes.push({
        section: 'testCases',
        changeType: 'preserved',
        description: 'Test cases preserved from original document'
      })
    }
  }
  
  // Track configuration warnings changes
  const originalWarnings = original.configurationWarnings?.length || 0
  const regeneratedWarnings = regenerated.configurationWarnings?.length || 0
  
  if (originalWarnings !== regeneratedWarnings) {
    changes.push({
      section: 'configurationWarnings',
      changeType: originalWarnings < regeneratedWarnings ? 'added' : 'modified',
      description: `Configuration warnings count changed from ${originalWarnings} to ${regeneratedWarnings}`,
      oldValue: originalWarnings,
      newValue: regeneratedWarnings
    })
  } else if (originalWarnings > 0) {
    changes.push({
      section: 'configurationWarnings',
      changeType: 'preserved',
      description: 'Configuration warnings preserved from original document'
    })
  }
  
  return changes
}

/**
 * Categorize changes into preserved and modified elements
 */
function categorizeChanges(changes: DocumentChange[]): {
  preservedElements: string[]
  modifiedElements: string[]
} {
  const preservedElements: string[] = []
  const modifiedElements: string[] = []
  
  changes.forEach(change => {
    if (change.changeType === 'preserved') {
      preservedElements.push(change.section)
    } else {
      modifiedElements.push(change.section)
    }
  })
  
  return { preservedElements, modifiedElements }
}

/**
 * Increment document version
 */
function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.')
  const major = parseInt(parts[0] || '1')
  const minor = parseInt(parts[1] || '0')
  
  return `${major}.${minor + 1}`
}

/**
 * Extract regeneration reason from user feedback
 */
function extractRegenerationReason(feedback: string): string {
  const feedback_lower = feedback.toLowerCase()
  
  if (feedback_lower.includes('add') || feedback_lower.includes('more')) {
    return 'Content addition requested'
  }
  
  if (feedback_lower.includes('change') || feedback_lower.includes('update') || feedback_lower.includes('modify')) {
    return 'Content modification requested'
  }
  
  if (feedback_lower.includes('improve') || feedback_lower.includes('better')) {
    return 'Quality improvement requested'
  }
  
  if (feedback_lower.includes('fix') || feedback_lower.includes('correct')) {
    return 'Error correction requested'
  }
  
  return 'User feedback incorporation'
}