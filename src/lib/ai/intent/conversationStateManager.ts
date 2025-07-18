/**
 * Conversation State Manager
 * Handles multi-turn clarification flows, state persistence, and conversation lifecycle
 */

import type { 
  ConversationState, 
  ConversationPhase, 
  ClarificationQuestion,
  IntentAnalysisResult,
  ContextSnapshot
} from './types'
import { CONVERSATION_LIMITS } from './constants'

/**
 * In-memory conversation state storage
 * In production, this would be replaced with Redis or database storage
 */
class ConversationStateStorage {
  private states = new Map<string, ConversationState>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanupTimer()
  }

  set(sessionId: string, state: ConversationState): void {
    this.states.set(sessionId, state)
  }

  get(sessionId: string): ConversationState | undefined {
    return this.states.get(sessionId)
  }

  delete(sessionId: string): boolean {
    return this.states.delete(sessionId)
  }

  has(sessionId: string): boolean {
    return this.states.has(sessionId)
  }

  getAllSessions(): string[] {
    return Array.from(this.states.keys())
  }

  size(): number {
    return this.states.size
  }

  clear(): void {
    this.states.clear()
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
    }, CONVERSATION_LIMITS.CLEANUP_INTERVAL)
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now()
    const expiredSessions: string[] = []

    for (const [sessionId, state] of this.states.entries()) {
      const lastActivity = new Date(state.lastActivity).getTime()
      if (now - lastActivity > CONVERSATION_LIMITS.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId)
      }
    }

    expiredSessions.forEach(sessionId => {
      this.states.delete(sessionId)
    })

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired conversation sessions`)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.states.clear()
  }
}

/**
 * Conversation State Manager
 * Manages conversation state lifecycle, transitions, and persistence
 */
export class ConversationStateManager {
  private storage: ConversationStateStorage

  constructor() {
    this.storage = new ConversationStateStorage()
  }

  /**
   * Initialize a new conversation session
   */
  initializeSession(sessionId: string): ConversationState {
    const now = new Date().toISOString()
    
    const initialState: ConversationState = {
      sessionId,
      currentPhase: 'initial',
      pendingClarifications: [],
      lastIntent: {
        intent: 'provide_information',
        confidence: 0,
        targetSections: [],
        context: {
          hasCanvas: false,
          canvasComplexity: 'simple',
          conversationLength: 0,
          availableSections: []
        },
        reasoning: 'Initial session state',
        keywords: [],
        shouldModifyCanvas: false,
        requiresClarification: false
      },
      contextHistory: [],
      awaitingResponse: false,
      createdAt: now,
      lastActivity: now
    }

    this.storage.set(sessionId, initialState)
    return initialState
  }

  /**
   * Get conversation state for a session
   */
  getState(sessionId: string): ConversationState | null {
    const state = this.storage.get(sessionId)
    if (!state) {
      return null
    }

    // Check if session has expired
    const now = Date.now()
    const lastActivity = new Date(state.lastActivity).getTime()
    if (now - lastActivity > CONVERSATION_LIMITS.SESSION_TIMEOUT) {
      this.storage.delete(sessionId)
      return null
    }

    return state
  }

  /**
   * Update conversation state
   */
  updateState(sessionId: string, updates: Partial<ConversationState>): ConversationState | null {
    const currentState = this.getState(sessionId)
    if (!currentState) {
      return null
    }

    const updatedState: ConversationState = {
      ...currentState,
      ...updates,
      lastActivity: new Date().toISOString()
    }

    this.storage.set(sessionId, updatedState)
    return updatedState
  }

  /**
   * Transition conversation to a new phase
   */
  transitionPhase(sessionId: string, newPhase: ConversationPhase): ConversationState | null {
    const currentState = this.getState(sessionId)
    if (!currentState) {
      return null
    }

    // Validate phase transition
    if (!this.isValidPhaseTransition(currentState.currentPhase, newPhase)) {
      throw new Error(`Invalid phase transition from ${currentState.currentPhase} to ${newPhase}`)
    }

    return this.updateState(sessionId, { 
      currentPhase: newPhase,
      awaitingResponse: newPhase === 'awaiting_clarification'
    })
  }

  /**
   * Add pending clarification questions
   */
  addPendingClarifications(sessionId: string, questions: ClarificationQuestion[]): ConversationState | null {
    const currentState = this.getState(sessionId)
    if (!currentState) {
      return null
    }

    // Limit the number of pending clarifications
    const existingQuestions = currentState.pendingClarifications
    const totalQuestions = existingQuestions.length + questions.length
    
    if (totalQuestions > CONVERSATION_LIMITS.MAX_PENDING_CLARIFICATIONS) {
      const allowedNewQuestions = CONVERSATION_LIMITS.MAX_PENDING_CLARIFICATIONS - existingQuestions.length
      questions = questions.slice(0, Math.max(0, allowedNewQuestions))
    }

    const updatedClarifications = [...existingQuestions, ...questions]

    return this.updateState(sessionId, {
      pendingClarifications: updatedClarifications,
      currentPhase: 'awaiting_clarification',
      awaitingResponse: true
    })
  }

  /**
   * Clear pending clarifications
   */
  clearPendingClarifications(sessionId: string): ConversationState | null {
    return this.updateState(sessionId, {
      pendingClarifications: [],
      awaitingResponse: false
    })
  }

  /**
   * Update last intent analysis result
   */
  updateLastIntent(sessionId: string, intent: IntentAnalysisResult): ConversationState | null {
    return this.updateState(sessionId, { lastIntent: intent })
  }

  /**
   * Add context snapshot to conversation history
   */
  addContextSnapshot(sessionId: string, snapshot: ContextSnapshot): ConversationState | null {
    const currentState = this.getState(sessionId)
    if (!currentState) {
      return null
    }

    let contextHistory = [...currentState.contextHistory, snapshot]

    // Limit context history size
    if (contextHistory.length > CONVERSATION_LIMITS.MAX_CONTEXT_HISTORY) {
      contextHistory = contextHistory.slice(-CONVERSATION_LIMITS.MAX_CONTEXT_HISTORY)
    }

    return this.updateState(sessionId, { contextHistory })
  }

  /**
   * Check if session exists and is active
   */
  isSessionActive(sessionId: string): boolean {
    return this.getState(sessionId) !== null
  }

  /**
   * Check if session is awaiting response
   */
  isAwaitingResponse(sessionId: string): boolean {
    const state = this.getState(sessionId)
    return state?.awaitingResponse ?? false
  }

  /**
   * Get pending clarifications for a session
   */
  getPendingClarifications(sessionId: string): ClarificationQuestion[] {
    const state = this.getState(sessionId)
    return state?.pendingClarifications ?? []
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string): ContextSnapshot[] {
    const state = this.getState(sessionId)
    return state?.contextHistory ?? []
  }

  /**
   * End conversation session
   */
  endSession(sessionId: string): boolean {
    const state = this.getState(sessionId)
    if (!state) {
      return false
    }

    this.updateState(sessionId, { 
      currentPhase: 'completed',
      awaitingResponse: false
    })

    return true
  }

  /**
   * Clean up expired sessions manually
   */
  cleanupExpiredSessions(): number {
    const now = Date.now()
    const expiredSessions: string[] = []

    for (const sessionId of this.storage.getAllSessions()) {
      const state = this.storage.get(sessionId)
      if (state) {
        const lastActivity = new Date(state.lastActivity).getTime()
        if (now - lastActivity > CONVERSATION_LIMITS.SESSION_TIMEOUT) {
          expiredSessions.push(sessionId)
        }
      }
    }

    expiredSessions.forEach(sessionId => {
      this.storage.delete(sessionId)
    })

    return expiredSessions.length
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number
    activeSessions: number
    awaitingResponseSessions: number
    averageConversationLength: number
  } {
    const allSessions = this.storage.getAllSessions()
    let awaitingResponseCount = 0
    let totalConversationLength = 0

    for (const sessionId of allSessions) {
      const state = this.storage.get(sessionId)
      if (state) {
        if (state.awaitingResponse) {
          awaitingResponseCount++
        }
        totalConversationLength += state.contextHistory.length
      }
    }

    return {
      totalSessions: allSessions.length,
      activeSessions: allSessions.length,
      awaitingResponseSessions: awaitingResponseCount,
      averageConversationLength: allSessions.length > 0 ? totalConversationLength / allSessions.length : 0
    }
  }

  /**
   * Destroy the state manager and cleanup resources
   */
  destroy(): void {
    this.storage.destroy()
  }

  /**
   * Validate if a phase transition is allowed
   */
  private isValidPhaseTransition(currentPhase: ConversationPhase, newPhase: ConversationPhase): boolean {
    const validTransitions: Record<ConversationPhase, ConversationPhase[]> = {
      initial: ['awaiting_clarification', 'processing_modification', 'providing_information', 'completed'],
      awaiting_clarification: ['processing_modification', 'providing_information', 'awaiting_clarification', 'completed'],
      processing_modification: ['awaiting_clarification', 'completed'],
      providing_information: ['awaiting_clarification', 'processing_modification', 'completed'],
      completed: ['initial'] // Allow restarting
    }

    return validTransitions[currentPhase]?.includes(newPhase) ?? false
  }
}

// Singleton instance for global use
export const conversationStateManager = new ConversationStateManager()

/**
 * Utility functions for conversation state management
 */

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if a conversation phase indicates active processing
 */
export function isActivePhase(phase: ConversationPhase): boolean {
  return ['awaiting_clarification', 'processing_modification', 'providing_information'].includes(phase)
}

/**
 * Check if a conversation phase indicates completion
 */
export function isCompletedPhase(phase: ConversationPhase): boolean {
  return phase === 'completed'
}

/**
 * Get human-readable phase description
 */
export function getPhaseDescription(phase: ConversationPhase): string {
  const descriptions: Record<ConversationPhase, string> = {
    initial: 'Conversation started',
    awaiting_clarification: 'Waiting for user clarification',
    processing_modification: 'Processing canvas modifications',
    providing_information: 'Providing information to user',
    completed: 'Conversation completed'
  }

  return descriptions[phase] || 'Unknown phase'
}