import {
  analyzeCoverageGaps,
  generateClarificationQuestions,
  identifyEdgeCases,
  generateTestPerspectives,
  mapGapToSuggestionType,
  mapAmbiguityToSuggestionType,
  mapEdgeCaseToSuggestionType,
  mapPerspectiveToSuggestionType
} from '../../../lib/ai/suggestionAlgorithms'
import { QACanvasDocument } from '../../../lib/schemas/QACanvasDocument'

// Sample test document for testing algorithms
const sampleDocument: QACanvasDocument = {
  ticketSummary: {
    problem: 'The login button does not work on mobile devices',
    solution: 'Fix the click handler for the button and improve error handling',
    context: 'Mobile application with authentication system'
  },
  configurationWarnings: [
    {
      type: 'category_mismatch',
      title: 'Mobile testing recommended',
      message: 'This ticket affects mobile functionality',
      recommendation: 'Enable mobile testing category',
      severity: 'medium'
    }
  ],
  acceptanceCriteria: [
    {
      id: 'ac-1',
      title: 'Login button works on mobile',
      description: 'User can successfully click the login button on mobile devices',
      priority: 'must',
      category: 'functional',
      testable: true
    },
    {
      id: 'ac-2',
      title: 'Error handling works',
      description: 'System shows appropriate error messages',
      priority: 'must',
      category: 'functional',
      testable: true
    }
  ],
  testCases: [
    {
      format: 'gherkin',
      id: 'tc-1',
      category: 'functional',
      priority: 'high',
      testCase: {
        scenario: 'User logs in successfully on mobile',
        given: ['User is on the mobile login page'],
        when: ['User taps the login button'],
        then: ['User is logged in successfully'],
        tags: ['@mobile', '@authentication']
      }
    }
  ],
  metadata: {
    generatedAt: new Date().toISOString(),
    qaProfile: {
      testCaseFormat: 'gherkin',
      qaCategories: {
        functional: true,
        ui: false,
        ux: false,
        performance: false,
        security: false,
        accessibility: false,
        api: false,
        database: false,
        negative: false,
        mobile: true
      }
    },
    ticketId: 'TEST-123',
    documentVersion: '1.0'
  }
}

// Document with ambiguous requirements
const ambiguousDocument: QACanvasDocument = {
  ...sampleDocument,
  ticketSummary: {
    problem: "It doesn't work properly",
    solution: "Make it work better",
    context: "The system should handle this appropriately"
  },
  acceptanceCriteria: [
    {
      id: 'ac-1',
      title: 'Reasonable performance',
      description: 'The system should respond in a reasonable time',
      priority: 'must',
      category: 'performance',
      testable: true
    }
  ]
}

// Document with missing test coverage
const missingCoverageDocument: QACanvasDocument = {
  ...sampleDocument,
  acceptanceCriteria: [
    ...sampleDocument.acceptanceCriteria,
    {
      id: 'ac-3',
      title: 'Security validation',
      description: 'System validates user credentials securely',
      priority: 'must',
      category: 'security',
      testable: true
    }
  ],
  metadata: {
    ...sampleDocument.metadata,
    qaProfile: {
      testCaseFormat: 'gherkin',
      qaCategories: {
        functional: true,
        ui: false,
        ux: false,
        performance: false,
        security: true,
        accessibility: false,
        api: false,
        database: false,
        negative: false,
        mobile: true
      }
    }
  }
}

import { describe, it, expect } from 'vitest'

describe('Suggestion Algorithms', () => {
  describe('analyzeCoverageGaps', () => {
    it('should identify missing test coverage for acceptance criteria', () => {
      const gaps = analyzeCoverageGaps(missingCoverageDocument)
      
      // Should find at least one gap for the security criterion
      expect(gaps.length).toBeGreaterThan(0)
      expect(gaps.some(gap => gap.category === 'security')).toBe(true)
    })
    
    it('should identify active categories without test coverage', () => {
      const gaps = analyzeCoverageGaps(missingCoverageDocument)
      
      // Should find a gap for the security category
      expect(gaps.some(gap => 
        gap.category === 'security' && 
        gap.description.includes('No test cases')
      )).toBe(true)
    })
    
    it('should not report gaps for categories with test coverage', () => {
      const gaps = analyzeCoverageGaps(sampleDocument)
      
      // Should not find gaps for functional category since it has test coverage
      expect(gaps.some(gap => 
        gap.category === 'functional' && 
        gap.description.includes('No test cases')
      )).toBe(false)
    })
  })
  
  describe('generateClarificationQuestions', () => {
    it('should identify vague terms in acceptance criteria', () => {
      const ambiguities = generateClarificationQuestions(ambiguousDocument)
      
      // Should find ambiguity in "reasonable performance"
      expect(ambiguities.length).toBeGreaterThan(0)
      expect(ambiguities.some(a => 
        a.text.includes('reasonable time')
      )).toBe(true)
    })
    
    it('should identify missing context in problem statement', () => {
      const ambiguities = generateClarificationQuestions(ambiguousDocument)
      
      // Should find ambiguity in vague problem statement
      expect(ambiguities.some(a => 
        a.source === 'Problem Statement' && 
        a.ambiguityType === 'missing_context'
      )).toBe(true)
    })
    
    it('should not generate questions for clear requirements', () => {
      const ambiguities = generateClarificationQuestions(sampleDocument)
      
      // Should not find ambiguity in clear acceptance criteria
      expect(ambiguities.some(a => 
        a.text.includes('User can successfully click')
      )).toBe(false)
    })
  })
  
  describe('identifyEdgeCases', () => {
    it('should identify edge cases for user input', () => {
      // Add input-related content to the document
      const inputDocument: QACanvasDocument = {
        ...sampleDocument,
        ticketSummary: {
          ...sampleDocument.ticketSummary,
          solution: 'Fix the form submission and input validation'
        }
      }
      
      const edgeCases = identifyEdgeCases(inputDocument)
      
      // Should find edge cases related to input validation
      expect(edgeCases.length).toBeGreaterThan(0)
      expect(edgeCases.some(ec => 
        ec.relatedTo === 'Input Validation'
      )).toBe(true)
    })
    
    it('should identify edge cases for authentication', () => {
      const edgeCases = identifyEdgeCases(sampleDocument)
      
      // Should find edge cases related to authentication
      expect(edgeCases.some(ec => 
        ec.relatedTo === 'Authentication'
      )).toBe(true)
    })
    
    it('should identify mobile-specific edge cases', () => {
      const edgeCases = identifyEdgeCases(sampleDocument)
      
      // Should find edge cases related to mobile
      expect(edgeCases.some(ec => 
        ec.relatedTo === 'Mobile UI'
      )).toBe(true)
    })
  })
  
  describe('generateTestPerspectives', () => {
    it('should generate UI testing perspectives for UI categories', () => {
      // Add UI category to the document
      const uiDocument: QACanvasDocument = {
        ...sampleDocument,
        metadata: {
          ...sampleDocument.metadata,
          qaProfile: {
            testCaseFormat: 'gherkin',
            qaCategories: {
              functional: true,
              ui: true,
              ux: false,
              performance: false,
              security: false,
              accessibility: false,
              api: false,
              database: false,
              negative: false,
              mobile: true
            }
          }
        }
      }
      
      const perspectives = generateTestPerspectives(uiDocument)
      
      // Should find UI testing perspectives
      expect(perspectives.length).toBeGreaterThan(0)
      expect(perspectives.some(p => 
        p.perspective === 'ui'
      )).toBe(true)
    })
    
    it('should generate functional testing perspectives', () => {
      const perspectives = generateTestPerspectives(sampleDocument)
      
      // Should find functional testing perspectives
      expect(perspectives.some(p => 
        p.perspective === 'functional'
      )).toBe(true)
    })
    
    it('should not generate perspectives for inactive categories', () => {
      const perspectives = generateTestPerspectives(sampleDocument)
      
      // Should not find security testing perspectives
      expect(perspectives.some(p => 
        p.perspective === 'security'
      )).toBe(false)
    })
  })
  
  describe('Mapping functions', () => {
    it('should map coverage gaps to correct suggestion types', () => {
      const gap = {
        category: 'edge_case',
        description: 'Missing edge case coverage',
        severity: 'high' as const,
        suggestedAction: 'Add edge case tests'
      }
      
      expect(mapGapToSuggestionType(gap)).toBe('edge_case')
      
      const uiGap = {
        category: 'ui',
        description: 'Missing UI tests',
        severity: 'medium' as const,
        suggestedAction: 'Add UI tests'
      }
      
      expect(mapGapToSuggestionType(uiGap)).toBe('ui_verification')
    })
    
    it('should map ambiguities to clarification questions', () => {
      const ambiguity = {
        source: 'Acceptance Criterion',
        text: 'System should respond quickly',
        ambiguityType: 'vague_term' as const,
        clarificationQuestion: 'What does quickly mean?'
      }
      
      expect(mapAmbiguityToSuggestionType(ambiguity)).toBe('clarification_question')
    })
    
    it('should map edge cases to edge case suggestion type', () => {
      const edgeCase = {
        scenario: 'Network timeout',
        relatedTo: 'Error Handling',
        priority: 'high' as const,
        rationale: 'System should handle network timeouts'
      }
      
      expect(mapEdgeCaseToSuggestionType(edgeCase)).toBe('edge_case')
    })
    
    it('should map test perspectives to appropriate suggestion types', () => {
      const uiPerspective = {
        perspective: 'ui' as const,
        description: 'Visual consistency',
        applicability: 'high' as const,
        implementationHint: 'Test across screen sizes'
      }
      
      expect(mapPerspectiveToSuggestionType(uiPerspective)).toBe('ui_verification')
      
      const functionalPerspective = {
        perspective: 'functional' as const,
        description: 'State management',
        applicability: 'high' as const,
        implementationHint: 'Test state transitions'
      }
      
      expect(mapPerspectiveToSuggestionType(functionalPerspective)).toBe('functional_test')
    })
  })
})