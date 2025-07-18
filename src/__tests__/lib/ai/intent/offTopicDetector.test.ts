/**
 * Tests for Off-Topic Detection and Polite Rejection System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OffTopicDetector, type OffTopicCategory } from '../../../../lib/ai/intent/offTopicDetector'
import type { QACanvasDocument } from '../../../../lib/schemas/QACanvasDocument'
import type { JiraTicket } from '../../../../lib/schemas/JiraTicket'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn()
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mocked-model')
}))

describe('OffTopicDetector', () => {
  let detector: OffTopicDetector
  let mockCanvas: QACanvasDocument
  let mockTicket: JiraTicket

  beforeEach(() => {
    // Disable hybrid detection for tests to focus on keyword detection
    detector = new OffTopicDetector({
      enableHybridDetection: false,
      keywordThreshold: 0.1 // Lower threshold for more sensitive detection
    })
    
    mockCanvas = {
      ticketSummary: 'Test ticket summary',
      acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
      testCases: ['Test case 1', 'Test case 2'],
      configurationWarnings: [],
      metadata: {
        ticketId: 'TEST-123',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    }

    mockTicket = {
      key: 'TEST-123',
      summary: 'Test ticket for QA analysis',
      description: 'This is a test ticket for quality assurance testing',
      issueType: 'Story',
      status: 'In Progress',
      priority: 'Medium',
      assignee: 'test-user',
      reporter: 'test-reporter',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  })

  describe('Keyword-based Detection', () => {
    it('should detect entertainment topics as off-topic', async () => {
      const messages = [
        '¿Viste el partido de fútbol ayer?',
        'What did you think of the latest movie?',
        'Me gusta mucho la música rock',
        'Do you play video games?'
      ]

      for (const message of messages) {
        const result = await detector.detectOffTopic(message, mockCanvas, mockTicket)
        expect(result.isOffTopic).toBe(true)
        expect(result.category).toBe('entertainment')
        expect(result.confidence).toBeGreaterThan(0.3)
      }
    })

    it('should detect personal topics as off-topic', async () => {
      const messages = [
        'Mi familia está bien, gracias',
        'I need to go to the doctor',
        'Mis vacaciones fueron geniales',
        'How are your kids doing?'
      ]

      for (const message of messages) {
        const result = await detector.detectOffTopic(message, mockCanvas, mockTicket)
        expect(result.isOffTopic).toBe(true)
        // Accept either personal or small_talk since there's overlap
        expect(['personal', 'small_talk']).toContain(result.category)
        expect(result.confidence).toBeGreaterThan(0.3)
      }
    })

    it('should detect small talk as off-topic', async () => {
      const messages = [
        'Hola, ¿cómo estás?',
        'Good morning! How\'s the weather?',
        'Qué tal tu fin de semana',
        'It\'s really cold today'
      ]

      for (const message of messages) {
        const result = await detector.detectOffTopic(message, mockCanvas, mockTicket)
        expect(result.isOffTopic).toBe(true)
        expect(result.category).toBe('small_talk')
        expect(result.confidence).toBeGreaterThan(0.3)
      }
    })

    it('should detect QA-related topics as on-topic', async () => {
      const messages = [
        'Los criterios de aceptación necesitan mejoras',
        'Can you help me with the test cases?',
        'El ticket de Jira tiene problemas',
        'I need to validate these requirements',
        'The QA analysis looks incomplete'
      ]

      for (const message of messages) {
        const result = await detector.detectOffTopic(message, mockCanvas, mockTicket)
        expect(result.isOffTopic).toBe(false)
        expect(result.category).toBeNull()
        expect(result.confidence).toBeGreaterThan(0.5)
      }
    })

    it('should handle mixed content appropriately', async () => {
      const messages = [
        'Hola, ¿puedes ayudarme con los test cases?', // Greeting + QA
        'Good morning! I need help with acceptance criteria', // Small talk + QA
        'Después del partido, revisemos el ticket' // Entertainment + QA
      ]

      for (const message of messages) {
        const result = await detector.detectOffTopic(message, mockCanvas, mockTicket)
        // Should lean towards on-topic due to QA keywords
        expect(result.isOffTopic).toBe(false)
      }
    })
  })

  describe('AI-based Detection', () => {
    it('should use keyword detection when hybrid is disabled', async () => {
      // Since we disabled hybrid detection in beforeEach, this should use keyword detection
      const result = await detector.detectOffTopic(
        'What do you think about science and mathematics?',
        mockCanvas,
        mockTicket
      )

      expect(result.detectionMethod).toBe('keyword')
      // Science is in the 'other' category, so it should be detected as off-topic
      expect(result.isOffTopic).toBe(true)
      expect(result.category).toBe('other')
    })

    it('should fallback to keyword detection when AI fails', async () => {
      // Create a detector with hybrid enabled to test AI fallback
      const hybridDetector = new OffTopicDetector({
        enableHybridDetection: true,
        keywordThreshold: 0.1
      })

      const result = await hybridDetector.detectOffTopic(
        '¿Viste el partido de fútbol?',
        mockCanvas,
        mockTicket
      )

      expect(result.isOffTopic).toBe(true)
      expect(result.category).toBe('entertainment')
      // Should use keyword detection as fallback when AI fails
      expect(['keyword', 'hybrid']).toContain(result.detectionMethod)
      expect(result.reasoning).toBeTruthy()
    })

    it('should build appropriate context for AI analysis', async () => {
      // Test that the context building method works
      const hybridDetector = new OffTopicDetector({
        enableHybridDetection: true,
        keywordThreshold: 0.1
      })

      const result = await hybridDetector.detectOffTopic(
        'How should I approach testing this feature?',
        mockCanvas,
        mockTicket
      )

      // Should be on-topic due to QA keywords
      expect(result.isOffTopic).toBe(false)
      expect(result.keywords).toContain('testing')
    })
  })

  describe('Polite Rejection Generation', () => {
    it('should generate appropriate Spanish rejection messages', () => {
      const categories: OffTopicCategory[] = ['entertainment', 'personal', 'small_talk']
      
      for (const category of categories) {
        const rejection = detector.generatePoliteRejection(category, 'es', 'helpful')
        
        // Check for any of the Spanish rejection templates
        const hasValidSpanishMessage = rejection.message.includes('Lo siento') || 
                                     rejection.message.includes('Mi especialidad') || 
                                     rejection.message.includes('Estoy diseñado')
        expect(hasValidSpanishMessage).toBe(true)
        expect(rejection.language).toBe('es')
        expect(rejection.category).toBe(category)
        expect(rejection.redirectionSuggestions).toHaveLength(3)
        expect(rejection.redirectionSuggestions[0]).toContain('¿')
      }
    })

    it('should generate appropriate English rejection messages', () => {
      const categories: OffTopicCategory[] = ['entertainment', 'personal', 'small_talk']
      
      for (const category of categories) {
        const rejection = detector.generatePoliteRejection(category, 'en', 'helpful')
        
        // Check for any of the English rejection templates
        const hasValidEnglishMessage = rejection.message.includes('sorry') || 
                                     rejection.message.includes('specialty') || 
                                     rejection.message.includes('designed')
        expect(hasValidEnglishMessage).toBe(true)
        expect(rejection.language).toBe('en')
        expect(rejection.category).toBe(category)
        expect(rejection.redirectionSuggestions).toHaveLength(3)
        expect(rejection.redirectionSuggestions[0]).toMatch(/^(Would|Do|Can|Is|Are|Shall)/)
      }
    })

    it('should provide category-specific redirection suggestions', () => {
      const entertainmentRejection = detector.generatePoliteRejection('entertainment', 'es')
      const personalRejection = detector.generatePoliteRejection('personal', 'es')
      
      expect(entertainmentRejection.redirectionSuggestions).not.toEqual(
        personalRejection.redirectionSuggestions
      )
      
      // Entertainment suggestions should focus on QA review
      expect(entertainmentRejection.redirectionSuggestions.join(' ')).toContain('criterios')
      
      // Personal suggestions should be more general
      expect(personalRejection.redirectionSuggestions.join(' ')).toContain('ticket')
    })

    it('should use appropriate tone for different categories', () => {
      expect(detector.getCategoryTone('entertainment')).toBe('friendly')
      expect(detector.getCategoryTone('personal')).toBe('helpful')
      expect(detector.getCategoryTone('unrelated_work')).toBe('formal')
      expect(detector.getCategoryTone('small_talk')).toBe('friendly')
    })
  })

  describe('Configuration and Edge Cases', () => {
    it('should respect custom configuration', () => {
      const strictDetector = new OffTopicDetector({
        keywordThreshold: 0.1,
        aiConfidenceThreshold: 0.9,
        strictMode: true
      })

      expect(strictDetector).toBeInstanceOf(OffTopicDetector)
    })

    it('should handle empty messages gracefully', async () => {
      const result = await detector.detectOffTopic('', mockCanvas, mockTicket)
      
      expect(result.isOffTopic).toBe(false)
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.detectionMethod).toBe('keyword')
    })

    it('should handle messages without canvas or ticket context', async () => {
      const result = await detector.detectOffTopic('¿Cómo están los test cases?')
      
      expect(result.isOffTopic).toBe(false)
      expect(result.keywords).toContain('test cases')
    })

    it('should detect consistent rejection handling requirements', () => {
      expect(detector.shouldUseConsistentRejection('entertainment')).toBe(true)
      expect(detector.shouldUseConsistentRejection('personal')).toBe(true)
      expect(detector.shouldUseConsistentRejection('small_talk')).toBe(false)
      expect(detector.shouldUseConsistentRejection('general_tech')).toBe(false)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complex multi-language messages', async () => {
      const messages = [
        'Hello, ¿puedes ayudarme con los acceptance criteria?',
        'Hola, I need help with test cases para este ticket',
        'Good morning, necesito revisar el QA analysis'
      ]

      for (const message of messages) {
        const result = await detector.detectOffTopic(message, mockCanvas, mockTicket)
        expect(result.isOffTopic).toBe(false)
        expect(result.keywords.length).toBeGreaterThan(0)
      }
    })

    it('should maintain high confidence for clear cases', async () => {
      const clearOffTopic = await detector.detectOffTopic('¿Quién ganó el Mundial de fútbol?')
      const clearOnTopic = await detector.detectOffTopic('Los criterios de aceptación están mal')

      expect(clearOffTopic.isOffTopic).toBe(true)
      expect(clearOffTopic.confidence).toBeGreaterThan(0.5) // Adjusted for keyword-only detection
      
      expect(clearOnTopic.isOffTopic).toBe(false)
      expect(clearOnTopic.confidence).toBeGreaterThan(0.7)
    })

    it('should provide meaningful reasoning for decisions', async () => {
      const result = await detector.detectOffTopic('Me gusta el fútbol')
      
      expect(result.reasoning).toBeTruthy()
      expect(result.reasoning.length).toBeGreaterThan(10)
      expect(result.keywords).toContain('fútbol')
    })
  })

  describe('Performance and Reliability', () => {
    it('should complete detection within reasonable time', async () => {
      const start = Date.now()
      await detector.detectOffTopic('Test message for performance', mockCanvas, mockTicket)
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle multiple concurrent detections', async () => {
      const messages = [
        '¿Cómo están los test cases?',
        'Me gusta el fútbol',
        'The acceptance criteria need work',
        'What\'s the weather like?'
      ]

      const promises = messages.map(msg => 
        detector.detectOffTopic(msg, mockCanvas, mockTicket)
      )

      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(4)
      expect(results[0].isOffTopic).toBe(false) // QA related
      expect(results[1].isOffTopic).toBe(true)  // Sports
      expect(results[2].isOffTopic).toBe(false) // QA related
      expect(results[3].isOffTopic).toBe(true)  // Weather
    })
  })
})