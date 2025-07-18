/**
 * Intent Analysis System - Main exports
 * Provides intelligent analysis of user intentions for QA canvas interactions
 */

// Core components
export { IntentAnalyzer } from './intentAnalyzer'
export { SectionTargetDetector } from './sectionTargetDetector'
export { DependencyAnalyzer } from './dependencyAnalyzer'
export { ClarificationGenerator } from './clarificationGenerator'
export { ContextualResponseGenerator } from './contextualResponseGenerator'
export { 
  ConversationStateManager, 
  conversationStateManager,
  generateSessionId,
  isActivePhase,
  isCompletedPhase,
  getPhaseDescription
} from './conversationStateManager'

// Types and interfaces
export type {
  IntentType,
  CanvasSection,
  ConversationPhase,
  IntentAnalysisResult,
  SectionTargetResult,
  SectionDependency,
  DependencyAnalysisResult,
  ClarificationQuestion,
  ClarificationResult,
  ContextualResponse,
  ConversationState,
  IntentAnalysisError,
  IntentAnalysisErrorResponse,
  AnalysisContext,
  ContentCitation,
  ContextSnapshot,
  ClarificationCategory
} from './types'

// Constants and configuration
export {
  SECTION_KEYWORDS,
  INTENT_KEYWORDS,
  SECTION_DEPENDENCIES,
  CONFIDENCE_THRESHOLDS,
  TEMPLATE_CLARIFICATION_QUESTIONS,
  REJECTION_TEMPLATES,
  RESPONSE_LIMITS,
  CONVERSATION_LIMITS
} from './constants'

// Validation schemas
export {
  intentTypeSchema,
  canvasSectionSchema,
  intentAnalysisResultSchema,
  clarificationQuestionSchema,
  clarificationResultSchema
} from './types'