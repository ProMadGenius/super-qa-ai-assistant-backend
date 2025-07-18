/**
 * Off-Topic Detection and Polite Rejection System
 * Handles detection of non-QA related queries and provides appropriate rejection responses
 */

import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { REJECTION_TEMPLATES } from './constants'
import type { QACanvasDocument } from '../../schemas/QACanvasDocument'
import type { JiraTicket } from '../../schemas/JiraTicket'

/**
 * Categories of off-topic content
 */
export type OffTopicCategory = 
  | 'entertainment'     // Sports, movies, music, etc.
  | 'personal'         // Personal questions, life advice
  | 'general_tech'     // Technology not related to QA/testing
  | 'unrelated_work'   // Work topics not related to current ticket
  | 'small_talk'       // Casual conversation, greetings
  | 'other'           // Other non-QA topics

/**
 * Off-topic detection result
 */
export interface OffTopicDetectionResult {
  isOffTopic: boolean
  category: OffTopicCategory | null
  confidence: number
  detectionMethod: 'keyword' | 'ai_analysis' | 'hybrid'
  keywords: string[]
  reasoning: string
}

/**
 * Polite rejection response
 */
export interface PoliteRejectionResponse {
  message: string
  redirectionSuggestions: string[]
  language: 'es' | 'en'
  category: OffTopicCategory
  tone: 'formal' | 'friendly' | 'helpful'
}

/**
 * Off-topic detection configuration
 */
interface OffTopicDetectionConfig {
  keywordThreshold: number
  aiConfidenceThreshold: number
  enableHybridDetection: boolean
  strictMode: boolean
}

/**
 * Default configuration for off-topic detection
 */
const DEFAULT_CONFIG: OffTopicDetectionConfig = {
  keywordThreshold: 0.3,
  aiConfidenceThreshold: 0.7,
  enableHybridDetection: true,
  strictMode: false
}

/**
 * Extended off-topic keyword categories
 */
const OFF_TOPIC_KEYWORDS: Record<OffTopicCategory, string[]> = {
  entertainment: [
    // Spanish
    'deporte', 'fútbol', 'baloncesto', 'tenis', 'música', 'canciones',
    'películas', 'series', 'televisión', 'cine', 'actores', 'artistas',
    'juegos', 'videojuegos', 'entretenimiento', 'diversión', 'partido',
    // English
    'sports', 'football', 'basketball', 'tennis', 'music', 'songs',
    'movies', 'movie', 'films', 'television', 'tv', 'actors', 'artists',
    'games', 'video games', 'entertainment', 'fun', 'rock'
  ],
  personal: [
    // Spanish
    'familia', 'hijos', 'esposa', 'esposo', 'pareja', 'amigos',
    'salud', 'enfermedad', 'médico', 'hospital', 'vacaciones',
    'viajes', 'casa', 'hogar', 'mascotas', 'perro', 'gato',
    // English
    'family', 'children', 'wife', 'husband', 'partner', 'friends',
    'health', 'illness', 'doctor', 'hospital', 'vacation',
    'travel', 'home', 'house', 'pets', 'dog', 'cat'
  ],
  general_tech: [
    // Spanish
    'programación', 'desarrollo web', 'base de datos', 'servidor',
    'redes', 'seguridad', 'inteligencia artificial', 'machine learning',
    'blockchain', 'criptomonedas', 'hardware', 'software',
    // English
    'programming', 'web development', 'database', 'server',
    'networking', 'security', 'artificial intelligence', 'machine learning',
    'blockchain', 'cryptocurrency', 'hardware', 'software'
  ],
  unrelated_work: [
    // Spanish
    'reunión', 'jefe', 'compañeros', 'oficina', 'trabajo remoto',
    'salario', 'promoción', 'recursos humanos', 'contrato',
    'horario', 'vacaciones laborales', 'empresa', 'negocio',
    // English
    'meeting', 'boss', 'colleagues', 'office', 'remote work',
    'salary', 'promotion', 'human resources', 'contract',
    'schedule', 'business', 'company', 'corporate'
  ],
  small_talk: [
    // Spanish
    'hola', 'buenos días', 'buenas tardes', 'buenas noches',
    'cómo estás', 'qué tal', 'clima', 'tiempo', 'lluvia', 'sol',
    'frío', 'calor', 'fin de semana', 'lunes', 'viernes',
    // English
    'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
    'how are you', 'what\'s up', 'weather', 'rain', 'sun',
    'cold', 'hot', 'weekend', 'monday', 'friday'
  ],
  other: [
    // Spanish
    'política', 'elecciones', 'gobierno', 'noticias', 'economía',
    'religión', 'filosofía', 'historia', 'geografía', 'ciencia',
    'matemáticas', 'física', 'química', 'biología',
    // English
    'politics', 'elections', 'government', 'news', 'economy',
    'religion', 'philosophy', 'history', 'geography', 'science',
    'mathematics', 'physics', 'chemistry', 'biology'
  ]
}

/**
 * QA-related keywords that indicate on-topic content
 */
const QA_RELATED_KEYWORDS = [
  // Spanish - more specific patterns
  'qa', 'quality assurance', 'calidad', 'pruebas', 'testing',
  'casos de prueba', 'test cases', 'criterios de aceptación', 'criterios',
  'ticket', 'jira', 'bug', 'defecto', 'error', 'funcionalidad',
  'requisitos', 'especificaciones', 'validación', 'verificación',
  // English - more specific patterns
  'quality assurance', 'testing', 'test cases', 'acceptance criteria',
  'requirements', 'specifications', 'validation', 'verification',
  'functionality', 'feature', 'bug', 'defect', 'issue'
]

/**
 * AI tool for off-topic detection
 */
const offTopicDetectionTool = z.object({
  isOffTopic: z.boolean().describe("Whether the message is off-topic for QA/testing context"),
  category: z.enum(['entertainment', 'personal', 'general_tech', 'unrelated_work', 'small_talk', 'other']).nullable().describe("Category of off-topic content, null if on-topic"),
  confidence: z.number().min(0).max(1).describe("Confidence score for the classification"),
  reasoning: z.string().describe("Explanation of why this is or isn't off-topic"),
  keywords: z.array(z.string()).describe("Key terms that influenced the classification")
})

/**
 * Off-Topic Detector Class
 */
export class OffTopicDetector {
  private config: OffTopicDetectionConfig

  constructor(config: Partial<OffTopicDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Detect if a message is off-topic using keyword analysis
   */
  private detectOffTopicByKeywords(message: string): {
    isOffTopic: boolean
    category: OffTopicCategory | null
    confidence: number
    keywords: string[]
  } {
    const normalizedMessage = message.toLowerCase()
    let maxOffTopicScore = 0
    let detectedCategory: OffTopicCategory | null = null
    let matchedOffTopicKeywords: string[] = []

    // Check for QA-related keywords first
    const qaKeywords = QA_RELATED_KEYWORDS.filter(keyword => {
      // Use simple word boundary check for multi-word phrases
      if (keyword.includes(' ')) {
        return normalizedMessage.includes(keyword.toLowerCase())
      }
      // Use word boundary for single words to avoid false positives like "test" in "movie"
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`)
      return regex.test(normalizedMessage)
    })

    // Check off-topic categories
    for (const [category, keywords] of Object.entries(OFF_TOPIC_KEYWORDS)) {
      const matches = keywords.filter(keyword => {
        // Use simple word boundary check for multi-word phrases
        if (keyword.includes(' ')) {
          return normalizedMessage.includes(keyword.toLowerCase())
        }
        // Use word boundary for single words
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`)
        return regex.test(normalizedMessage)
      })
      
      if (matches.length > 0) {
        // Calculate score based on number of matches and keyword strength
        const score = matches.length > 0 ? Math.min(matches.length * 0.4, 1) : 0
        if (score > maxOffTopicScore) {
          maxOffTopicScore = score
          detectedCategory = category as OffTopicCategory
          matchedOffTopicKeywords = matches
        }
      }
    }

    // If we have both QA and off-topic keywords, QA takes precedence unless off-topic is very strong
    if (qaKeywords.length > 0 && maxOffTopicScore < 0.7) {
      return {
        isOffTopic: false,
        category: null,
        confidence: 0.8,
        keywords: qaKeywords
      }
    }

    // If we have strong off-topic keywords, classify as off-topic
    if (maxOffTopicScore >= this.config.keywordThreshold) {
      return {
        isOffTopic: true,
        category: detectedCategory,
        confidence: Math.min(maxOffTopicScore * 1.5, 1),
        keywords: matchedOffTopicKeywords
      }
    }

    // Default to on-topic if no strong indicators either way
    return {
      isOffTopic: false,
      category: null,
      confidence: qaKeywords.length > 0 ? 0.8 : 0.5,
      keywords: qaKeywords
    }
  }

  /**
   * Detect if a message is off-topic using AI analysis
   */
  private async detectOffTopicByAI(
    message: string,
    canvas?: QACanvasDocument,
    ticket?: JiraTicket
  ): Promise<{
    isOffTopic: boolean
    category: OffTopicCategory | null
    confidence: number
    reasoning: string
    keywords: string[]
  }> {
    try {
      const context = this.buildContextForAI(canvas, ticket)
      
      const prompt = `
You are an expert at determining whether user messages are related to QA (Quality Assurance), software testing, or the current Jira ticket context.

Context:
${context}

User Message: "${message}"

Determine if this message is off-topic for a QA/testing assistant. Consider:
1. Is it asking about QA, testing, acceptance criteria, test cases, or the current ticket?
2. Is it requesting modifications to QA documentation?
3. Is it asking for explanations about testing concepts?
4. Or is it about unrelated topics like sports, personal life, general technology, etc.?

Messages should be considered ON-TOPIC if they relate to:
- Quality assurance and testing
- The current Jira ticket and its requirements
- Acceptance criteria and test cases
- QA methodologies and best practices
- Clarifications about the current canvas content

Messages should be considered OFF-TOPIC if they relate to:
- Entertainment (sports, movies, music)
- Personal matters (family, health, travel)
- General technology not related to QA
- Unrelated work topics
- Small talk and casual conversation
- Other non-QA subjects
`

      const result = await generateObject({
        model: openai('gpt-4o-mini'),
        prompt,
        schema: offTopicDetectionTool,
        temperature: 0.1
      })

      return {
        isOffTopic: result.object.isOffTopic,
        category: result.object.category,
        confidence: result.object.confidence,
        reasoning: result.object.reasoning,
        keywords: result.object.keywords
      }
    } catch (error) {
      console.error('AI off-topic detection failed:', error)
      // Fallback to keyword detection
      const keywordResult = this.detectOffTopicByKeywords(message)
      return {
        ...keywordResult,
        reasoning: 'AI analysis failed, used keyword fallback'
      }
    }
  }

  /**
   * Build context string for AI analysis
   */
  private buildContextForAI(canvas?: QACanvasDocument, ticket?: JiraTicket): string {
    let context = "This is a QA assistant that helps with software testing and quality assurance."
    
    if (ticket) {
      context += `\n\nCurrent Jira Ticket:
- Summary: ${ticket.summary || 'N/A'}
- Description: ${ticket.description ? ticket.description.substring(0, 200) + '...' : 'N/A'}`
    }
    
    if (canvas) {
      context += `\n\nCurrent QA Canvas:
- Has acceptance criteria: ${canvas.acceptanceCriteria ? 'Yes' : 'No'}
- Has test cases: ${canvas.testCases ? 'Yes' : 'No'}
- Has ticket summary: ${canvas.ticketSummary ? 'Yes' : 'No'}`
    }
    
    return context
  }

  /**
   * Main method to detect off-topic content
   */
  async detectOffTopic(
    message: string,
    canvas?: QACanvasDocument,
    ticket?: JiraTicket
  ): Promise<OffTopicDetectionResult> {
    // Always start with keyword detection for speed
    const keywordResult = this.detectOffTopicByKeywords(message)
    
    // If keyword detection is confident, use it
    if (keywordResult.confidence >= 0.8) {
      return {
        isOffTopic: keywordResult.isOffTopic,
        category: keywordResult.category,
        confidence: keywordResult.confidence,
        detectionMethod: 'keyword',
        keywords: keywordResult.keywords,
        reasoning: keywordResult.isOffTopic 
          ? `Strong keyword match for ${keywordResult.category} category`
          : 'Strong QA-related keyword match'
      }
    }

    // Use AI analysis for ambiguous cases
    if (this.config.enableHybridDetection) {
      try {
        const aiResult = await this.detectOffTopicByAI(message, canvas, ticket)
        
        // Combine keyword and AI results
        const combinedConfidence = (keywordResult.confidence + aiResult.confidence) / 2
        const finalIsOffTopic = aiResult.confidence >= this.config.aiConfidenceThreshold 
          ? aiResult.isOffTopic 
          : keywordResult.isOffTopic

        return {
          isOffTopic: finalIsOffTopic,
          category: finalIsOffTopic ? (aiResult.category || keywordResult.category) : null,
          confidence: combinedConfidence,
          detectionMethod: 'hybrid',
          keywords: [...new Set([...keywordResult.keywords, ...aiResult.keywords])],
          reasoning: `Hybrid analysis: ${aiResult.reasoning}`
        }
      } catch (error) {
        console.error('Hybrid detection failed, falling back to keywords:', error)
        return {
          ...keywordResult,
          detectionMethod: 'keyword',
          reasoning: 'AI analysis failed, used keyword detection'
        }
      }
    }

    // Fallback to keyword result
    return {
      ...keywordResult,
      detectionMethod: 'keyword',
      reasoning: keywordResult.isOffTopic 
        ? `Keyword match for ${keywordResult.category} category`
        : 'No off-topic keywords detected'
    }
  }

  /**
   * Generate polite rejection response
   */
  generatePoliteRejection(
    category: OffTopicCategory,
    language: 'es' | 'en' = 'es',
    tone: 'formal' | 'friendly' | 'helpful' = 'helpful'
  ): PoliteRejectionResponse {
    const templates = REJECTION_TEMPLATES[language]
    const baseMessage = templates[Math.floor(Math.random() * templates.length)]
    
    const redirectionSuggestions = this.generateRedirectionSuggestions(category, language)
    
    return {
      message: baseMessage,
      redirectionSuggestions,
      language,
      category,
      tone
    }
  }

  /**
   * Generate redirection suggestions based on category
   */
  private generateRedirectionSuggestions(
    category: OffTopicCategory,
    language: 'es' | 'en'
  ): string[] {
    const suggestions = {
      es: {
        entertainment: [
          "¿Te gustaría revisar los criterios de aceptación del ticket actual?",
          "¿Necesitas ayuda con los casos de prueba?",
          "¿Hay algo específico del análisis de QA que quieras mejorar?"
        ],
        personal: [
          "¿Podemos enfocarnos en el ticket de Jira actual?",
          "¿Hay aspectos del testing que necesiten atención?",
          "¿Te gustaría que revisemos la documentación de QA?"
        ],
        general_tech: [
          "¿Cómo se relaciona esto con el testing del ticket actual?",
          "¿Necesitas ayuda con aspectos específicos de QA?",
          "¿Podemos aplicar esto al análisis de calidad actual?"
        ],
        unrelated_work: [
          "¿Podemos volver al análisis del ticket de Jira?",
          "¿Hay aspectos de QA que necesiten revisión?",
          "¿Te gustaría mejorar alguna sección del lienzo actual?"
        ],
        small_talk: [
          "¿Empezamos con el análisis del ticket?",
          "¿Qué aspecto del QA te gustaría revisar primero?",
          "¿Necesitas ayuda con alguna sección específica?"
        ],
        other: [
          "¿Volvemos al tema del ticket de Jira?",
          "¿Hay algo sobre testing que necesites clarificar?",
          "¿Te gustaría que revisemos los criterios de aceptación?"
        ]
      },
      en: {
        entertainment: [
          "Would you like to review the acceptance criteria for the current ticket?",
          "Do you need help with the test cases?",
          "Is there something specific about the QA analysis you'd like to improve?"
        ],
        personal: [
          "Can we focus on the current Jira ticket?",
          "Are there testing aspects that need attention?",
          "Would you like us to review the QA documentation?"
        ],
        general_tech: [
          "How does this relate to testing the current ticket?",
          "Do you need help with specific QA aspects?",
          "Can we apply this to the current quality analysis?"
        ],
        unrelated_work: [
          "Can we return to analyzing the Jira ticket?",
          "Are there QA aspects that need review?",
          "Would you like to improve any section of the current canvas?"
        ],
        small_talk: [
          "Shall we start with the ticket analysis?",
          "What aspect of QA would you like to review first?",
          "Do you need help with any specific section?"
        ],
        other: [
          "Shall we return to the Jira ticket topic?",
          "Is there something about testing you need to clarify?",
          "Would you like us to review the acceptance criteria?"
        ]
      }
    }

    return suggestions[language][category] || suggestions[language].other
  }

  /**
   * Check if rejection handling should be consistent across categories
   */
  shouldUseConsistentRejection(category: OffTopicCategory): boolean {
    // Some categories might need different handling
    const specialHandlingCategories: OffTopicCategory[] = ['small_talk', 'general_tech']
    return !specialHandlingCategories.includes(category)
  }

  /**
   * Get category-specific rejection tone
   */
  getCategoryTone(category: OffTopicCategory): 'formal' | 'friendly' | 'helpful' {
    const toneMapping: Record<OffTopicCategory, 'formal' | 'friendly' | 'helpful'> = {
      entertainment: 'friendly',
      personal: 'helpful',
      general_tech: 'helpful',
      unrelated_work: 'formal',
      small_talk: 'friendly',
      other: 'formal'
    }
    
    return toneMapping[category] || 'helpful'
  }
}

/**
 * Default instance for easy importing
 */
export const offTopicDetector = new OffTopicDetector()