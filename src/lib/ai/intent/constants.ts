/**
 * Configuration constants for intent analysis system
 * Contains keyword mappings, section dependencies, and classification thresholds
 */

import type { CanvasSection, SectionDependency } from './types'

/**
 * Keyword mappings for section detection (Spanish and English)
 */
export const SECTION_KEYWORDS: Record<CanvasSection, string[]> = {
  acceptanceCriteria: [
    // Spanish
    'criterios de aceptación', 'criterios', 'aceptación', 'requisitos', 'condiciones',
    'debe cumplir', 'debe satisfacer', 'debe hacer', 'debe permitir',
    // English
    'acceptance criteria', 'criteria', 'acceptance', 'requirements', 'conditions',
    'must satisfy', 'must meet', 'must allow', 'must enable', 'should satisfy'
  ],
  testCases: [
    // Spanish
    'test cases', 'casos de prueba', 'pruebas', 'tests', 'testing',
    'casos de test', 'escenarios de prueba', 'validación', 'verificación',
    // English
    'test cases', 'test case', 'tests', 'testing', 'scenarios',
    'test scenarios', 'validation', 'verification', 'test plan'
  ],
  ticketSummary: [
    // Spanish
    'resumen', 'explicación', 'descripción', 'contexto', 'problema',
    'solución', 'funcionalidad', 'feature', 'historia',
    // English
    'summary', 'explanation', 'description', 'context', 'problem',
    'solution', 'functionality', 'feature', 'story', 'overview'
  ],
  configurationWarnings: [
    // Spanish
    'configuración', 'advertencias', 'warnings', 'conflictos', 'problemas',
    'configuraciones', 'ajustes', 'settings',
    // English
    'configuration', 'warnings', 'conflicts', 'issues', 'problems',
    'settings', 'config', 'setup'
  ],
  metadata: [
    // Spanish
    'metadata', 'metadatos', 'información', 'detalles', 'propiedades',
    // English
    'metadata', 'meta data', 'information', 'details', 'properties'
  ]
}

/**
 * Intent classification keywords (Spanish and English)
 */
export const INTENT_KEYWORDS = {
  modify_canvas: [
    // Spanish - modification requests
    'cambiar', 'modificar', 'actualizar', 'corregir', 'arreglar', 'mejorar',
    'editar', 'revisar', 'ajustar', 'alterar', 'reemplazar', 'quitar',
    'agregar', 'añadir', 'incluir', 'eliminar', 'borrar',
    // English - modification requests
    'change', 'modify', 'update', 'correct', 'fix', 'improve',
    'edit', 'revise', 'adjust', 'alter', 'replace', 'remove',
    'add', 'include', 'delete', 'eliminate'
  ],
  ask_clarification: [
    // Spanish - vague complaints
    'está mal', 'no está bien', 'no me gusta', 'necesita mejoras',
    'no funciona', 'está incorrecto', 'está equivocado', 'falta algo',
    'no es suficiente', 'podría ser mejor',
    // English - vague complaints
    'is wrong', 'not right', 'not good', 'needs improvement',
    'doesn\'t work', 'incorrect', 'missing something', 'not enough',
    'could be better', 'needs work'
  ],
  provide_information: [
    // Spanish - information requests
    '¿qué significa?', '¿puedes explicar?', '¿cómo funciona?', '¿por qué?',
    'explícame', 'cuéntame', 'dime', 'información sobre', 'detalles de',
    // English - information requests
    'what does', 'can you explain', 'how does', 'why', 'tell me',
    'explain', 'information about', 'details about', 'what is'
  ],
  request_explanation: [
    // Spanish - explanation requests
    'explica', 'explicación', 'ayúdame a entender', 'no entiendo',
    'clarifica', 'aclaración', '¿cómo se relaciona?',
    // English - explanation requests
    'explain', 'explanation', 'help me understand', 'don\'t understand',
    'clarify', 'clarification', 'how does this relate'
  ],
  off_topic: [
    // Spanish - off-topic indicators
    'deporte', 'fútbol', 'clima', 'tiempo', 'comida', 'recetas',
    'música', 'películas', 'política', 'noticias', 'chistes',
    // English - off-topic indicators
    'sports', 'football', 'weather', 'food', 'recipes', 'music',
    'movies', 'politics', 'news', 'jokes', 'entertainment'
  ]
}

/**
 * Section dependency mapping
 * Defines how changes in one section affect others
 */
export const SECTION_DEPENDENCIES: Record<CanvasSection, SectionDependency[]> = {
  acceptanceCriteria: [
    {
      from: 'acceptanceCriteria',
      to: 'testCases',
      relationship: 'derives_from',
      strength: 'strong',
      description: 'Test cases are typically derived from acceptance criteria'
    }
  ],
  ticketSummary: [
    {
      from: 'ticketSummary',
      to: 'acceptanceCriteria',
      relationship: 'implements',
      strength: 'medium',
      description: 'Acceptance criteria implement the requirements in ticket summary'
    },
    {
      from: 'ticketSummary',
      to: 'testCases',
      relationship: 'validates',
      strength: 'medium',
      description: 'Test cases validate the functionality described in ticket summary'
    }
  ],
  testCases: [],
  configurationWarnings: [],
  metadata: []
}

/**
 * Confidence thresholds for intent classification
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.8,
  MEDIUM_CONFIDENCE: 0.6,
  LOW_CONFIDENCE: 0.4,
  MINIMUM_CONFIDENCE: 0.2
}

/**
 * Template clarification questions for common scenarios
 */
export const TEMPLATE_CLARIFICATION_QUESTIONS = {
  vague_complaint: {
    es: [
      "¿Qué específicamente no te gusta de {section}?",
      "¿Podrías darme un ejemplo de lo que debería cambiar?",
      "¿Qué aspecto particular necesita mejora?"
    ],
    en: [
      "What specifically don't you like about {section}?",
      "Could you give me an example of what should change?",
      "What particular aspect needs improvement?"
    ]
  },
  missing_context: {
    es: [
      "¿Podrías ser más específico sobre qué cambios necesitas?",
      "¿Qué resultado esperas después del cambio?",
      "¿Hay algún ejemplo que puedas compartir?"
    ],
    en: [
      "Could you be more specific about what changes you need?",
      "What result do you expect after the change?",
      "Is there an example you can share?"
    ]
  },
  scope_clarification: {
    es: [
      "¿Quieres que modifique solo {section} o también otras secciones?",
      "¿Este cambio debería afectar los casos de prueba también?",
      "¿Necesitas que actualice las secciones relacionadas?"
    ],
    en: [
      "Do you want me to modify only {section} or other sections too?",
      "Should this change affect the test cases as well?",
      "Do you need me to update related sections?"
    ]
  }
}

/**
 * Polite rejection templates for off-topic queries
 */
export const REJECTION_TEMPLATES = {
  es: [
    "Lo siento, pero solo puedo ayudarte con temas relacionados al ticket de Jira y el análisis de QA. ¿Hay algo específico sobre los criterios de aceptación o casos de prueba que te gustaría revisar?",
    "Mi especialidad es ayudar con documentación de QA y análisis de tickets. ¿Te gustaría que revisemos algún aspecto específico del lienzo actual?",
    "Estoy diseñado para asistir con temas de QA y testing. ¿Hay algo sobre el ticket actual que necesites aclarar o mejorar?"
  ],
  en: [
    "I'm sorry, but I can only help with topics related to the Jira ticket and QA analysis. Is there something specific about the acceptance criteria or test cases you'd like to review?",
    "My specialty is helping with QA documentation and ticket analysis. Would you like us to review any specific aspect of the current canvas?",
    "I'm designed to assist with QA and testing topics. Is there something about the current ticket that you need to clarify or improve?"
  ]
}

/**
 * Response time limits (in milliseconds)
 */
export const RESPONSE_LIMITS = {
  INTENT_ANALYSIS_TIMEOUT: 10000,  // 10 seconds
  CLARIFICATION_GENERATION_TIMEOUT: 8000,  // 8 seconds
  CONTEXTUAL_RESPONSE_TIMEOUT: 12000,  // 12 seconds
  DEPENDENCY_ANALYSIS_TIMEOUT: 6000   // 6 seconds
}

/**
 * Conversation state limits
 */
export const CONVERSATION_LIMITS = {
  MAX_CONTEXT_HISTORY: 20,  // Maximum conversation snapshots to keep
  MAX_PENDING_CLARIFICATIONS: 5,  // Maximum pending clarification questions
  SESSION_TIMEOUT: 30 * 60 * 1000,  // 30 minutes in milliseconds
  CLEANUP_INTERVAL: 5 * 60 * 1000   // 5 minutes cleanup interval
}