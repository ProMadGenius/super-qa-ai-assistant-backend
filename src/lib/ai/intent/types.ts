/**
 * Core types and interfaces for the Intent Analysis System
 * Defines the structure for intent classification, section targeting, and conversation management
 */

import { z } from 'zod'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import type { JiraTicket } from '../../schemas/JiraTicket'

/**
 * Intent types that the system can classify
 */
export type IntentType = 
  | 'modify_canvas'      // User wants to modify the canvas content
  | 'ask_clarification'  // User's request is unclear, need more info
  | 'provide_information' // User wants information without modification
  | 'request_explanation' // User wants explanation of existing content
  | 'off_topic'          // User's message is not related to QA/ticket

/**
 * Canvas sections that can be targeted for modification
 */
export type CanvasSection = 
  | 'ticketSummary'
  | 'acceptanceCriteria'
  | 'testCases'
  | 'configurationWarnings'
  | 'metadata'

/**
 * Conversation phases for state management
 */
export type ConversationPhase = 
  | 'initial'
  | 'awaiting_clarification'
  | 'processing_modification'
  | 'providing_information'
  | 'completed'

/**
 * Analysis context for intent classification
 */
export interface AnalysisContext {
  hasCanvas: boolean
  canvasComplexity: 'simple' | 'medium' | 'complex'
  conversationLength: number
  lastUserIntent?: IntentType
  availableSections: CanvasSection[]
}

/**
 * Result of intent analysis
 */
export interface IntentAnalysisResult {
  intent: IntentType
  confidence: number
  targetSections: CanvasSection[]
  context: AnalysisContext
  reasoning: string
  keywords: string[]
  shouldModifyCanvas: boolean
  requiresClarification: boolean
}

/**
 * Section target detection result
 */
export interface SectionTargetResult {
  primaryTargets: CanvasSection[]
  secondaryTargets: CanvasSection[]
  keywords: string[]
  confidence: number
  detectionMethod: 'keyword' | 'ai_analysis' | 'hybrid'
}

/**
 * Section dependency relationship
 */
export interface SectionDependency {
  from: CanvasSection
  to: CanvasSection
  relationship: 'derives_from' | 'validates' | 'implements' | 'references'
  strength: 'strong' | 'medium' | 'weak'
  description: string
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysisResult {
  affectedSections: CanvasSection[]
  dependencies: SectionDependency[]
  cascadeRequired: boolean
  impactAssessment: string
  conflictRisk: 'high' | 'medium' | 'low'
  validationResult?: DependencyValidationResult
}

/**
 * Types of dependency conflicts
 */
export type ConflictType = 
  | 'inconsistent_content'     // Content between sections is inconsistent
  | 'missing_dependency'       // Required dependency is missing
  | 'circular_dependency'      // Circular dependency detected
  | 'orphaned_content'         // Content exists without proper dependencies
  | 'version_mismatch'         // Different versions/formats between sections

/**
 * Severity levels for conflicts
 */
export type ConflictSeverity = 'critical' | 'major' | 'minor' | 'warning'

/**
 * Individual dependency conflict
 */
export interface DependencyConflict {
  type: ConflictType
  severity: ConflictSeverity
  affectedSections: CanvasSection[]
  description: string
  currentState: string
  expectedState: string
  suggestedResolution: string
  autoResolvable: boolean
}

/**
 * Dependency validation result
 */
export interface DependencyValidationResult {
  isValid: boolean
  conflicts: DependencyConflict[]
  warnings: string[]
  suggestions: ConflictResolutionSuggestion[]
  validationScore: number // 0-100, higher is better
}

/**
 * Conflict resolution suggestion
 */
export interface ConflictResolutionSuggestion {
  conflictId: string
  title: string
  description: string
  actions: ResolutionAction[]
  estimatedEffort: 'low' | 'medium' | 'high'
  priority: 'high' | 'medium' | 'low'
  affectedSections: CanvasSection[]
}

/**
 * Resolution action for conflicts
 */
export interface ResolutionAction {
  type: 'modify_section' | 'add_content' | 'remove_content' | 'reorder_content' | 'merge_sections'
  section: CanvasSection
  description: string
  content?: string
  position?: number
}

/**
 * User notification for dependency changes
 */
export interface DependencyChangeNotification {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  affectedSections: CanvasSection[]
  actions?: NotificationAction[]
  dismissible: boolean
  timestamp: string
}

/**
 * Notification action
 */
export interface NotificationAction {
  label: string
  action: 'accept_changes' | 'reject_changes' | 'review_conflicts' | 'apply_suggestions'
  data?: any
}

/**
 * Clarification question categories
 */
export type ClarificationCategory = 
  | 'specification'  // What specifically needs to change
  | 'scope'         // Which parts should be affected
  | 'priority'      // What's most important
  | 'format'        // How should it be formatted
  | 'dependency'    // How changes affect other sections

/**
 * Individual clarification question
 */
export interface ClarificationQuestion {
  question: string
  category: ClarificationCategory
  targetSection: CanvasSection
  examples?: string[]
  priority: 'high' | 'medium' | 'low'
}

/**
 * Clarification generation result
 */
export interface ClarificationResult {
  questions: ClarificationQuestion[]
  context: string
  suggestedActions: string[]
  estimatedClarificationTime: number
}

/**
 * Content citation for contextual responses
 */
export interface ContentCitation {
  section: CanvasSection
  content: string
  relevance: 'high' | 'medium' | 'low'
  lineNumber?: number
}

/**
 * Contextual response for information requests
 */
export interface ContextualResponse {
  response: string
  relevantSections: CanvasSection[]
  citations: ContentCitation[]
  suggestedFollowUps: string[]
  confidence: number
}

/**
 * Conversation state snapshot
 */
export interface ContextSnapshot {
  timestamp: string
  canvasState: QACanvasDocument
  userMessage: string
  systemResponse: string
  intent: IntentType
  confidence: number
}

/**
 * Conversation state management
 */
export interface ConversationState {
  sessionId: string
  currentPhase: ConversationPhase
  pendingClarifications: ClarificationQuestion[]
  lastIntent: IntentAnalysisResult
  contextHistory: ContextSnapshot[]
  awaitingResponse: boolean
  createdAt: string
  lastActivity: string
}

/**
 * Intent analysis error types
 */
export interface IntentAnalysisError extends Error {
  code: 'INTENT_CLASSIFICATION_FAILED' | 'INSUFFICIENT_CONTEXT' | 'AMBIGUOUS_INTENT' | 'AI_SERVICE_ERROR'
  context: {
    userMessage: string
    availableContext: string[]
    suggestedActions: string[]
  }
  fallbackIntent: IntentType
  recoverable: boolean
}

/**
 * Error response format for intent analysis failures
 */
export interface IntentAnalysisErrorResponse {
  error: 'INTENT_ANALYSIS_ERROR'
  message: string
  fallbackAction: {
    type: IntentType
    reasoning: string
    suggestedUserAction: string
  }
  context: {
    originalMessage: string
    availableOptions: string[]
  }
  timestamp: string
}

/**
 * Zod schemas for validation
 */

export const intentTypeSchema = z.enum([
  'modify_canvas',
  'ask_clarification', 
  'provide_information',
  'request_explanation',
  'off_topic'
])

export const canvasSectionSchema = z.enum([
  'ticketSummary',
  'acceptanceCriteria',
  'testCases',
  'configurationWarnings',
  'metadata'
])

export const intentAnalysisResultSchema = z.object({
  intent: intentTypeSchema,
  confidence: z.number().min(0).max(1),
  targetSections: z.array(canvasSectionSchema),
  reasoning: z.string(),
  keywords: z.array(z.string()),
  shouldModifyCanvas: z.boolean(),
  requiresClarification: z.boolean()
})

export const clarificationQuestionSchema = z.object({
  question: z.string(),
  category: z.enum(['specification', 'scope', 'priority', 'format', 'dependency']),
  targetSection: canvasSectionSchema,
  examples: z.array(z.string()).optional(),
  priority: z.enum(['high', 'medium', 'low'])
})

export const clarificationResultSchema = z.object({
  questions: z.array(clarificationQuestionSchema),
  context: z.string(),
  suggestedActions: z.array(z.string())
})