import { 
  generateClarifyingQuestions,
  documentAssumptions,
  generatePartialResults,
  formatTryVerifyFeedbackResponse,
  processAmbiguousRequest,
  UncertaintyType
} from '../../../lib/ai/uncertaintyHandler'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Uncertainty Handler', () => {
  describe('generateClarifyingQuestions', () => {
    it('should generate format-related questions', () => {
      const ambiguities = ['test case format']
      const context = {}
      
      const questions = generateClarifyingQuestions(ambiguities, context)
      
      expect(questions.length).toBe(1)
      expect(questions[0].question).toContain('format')
      expect(questions[0].options).toContain('Gherkin')
    })
    
    it('should generate category-related questions', () => {
      const ambiguities = ['test category']
      const context = {}
      
      const questions = generateClarifyingQuestions(ambiguities, context)
      
      expect(questions.length).toBe(1)
      expect(questions[0].question).toContain('categories')
      expect(questions[0].options).toContain('Functional')
    })
    
    it('should generate priority-related questions', () => {
      const ambiguities = ['test priority']
      const context = {}
      
      const questions = generateClarifyingQuestions(ambiguities, context)
      
      expect(questions.length).toBe(1)
      expect(questions[0].question).toContain('priority')
      expect(questions[0].options).toContain('Critical')
    })
    
    it('should generate generic questions for unknown ambiguities', () => {
      const ambiguities = ['something unclear']
      const context = {}
      
      const questions = generateClarifyingQuestions(ambiguities, context)
      
      expect(questions.length).toBe(1)
      expect(questions[0].question).toContain('clarify')
      expect(questions[0].context).toBe('General clarification')
    })
  })
  
  describe('documentAssumptions', () => {
    it('should identify missing test case format', () => {
      const request = { content: 'Generate test cases' }
      const context = { userPreferences: {} }
      
      const assumptions = documentAssumptions(request, context)
      
      expect(assumptions.length).toBeGreaterThan(0)
      expect(assumptions.some(a => a.type === UncertaintyType.MISSING_CONTEXT)).toBe(true)
      expect(assumptions.some(a => a.description.includes('test case format'))).toBe(true)
    })
    
    it('should identify vague terms', () => {
      const request = { content: 'Please improve the test cases' }
      const context = { userPreferences: { testCaseFormat: 'gherkin' } }
      
      const assumptions = documentAssumptions(request, context)
      
      expect(assumptions.length).toBeGreaterThan(0)
      expect(assumptions.some(a => a.type === UncertaintyType.AMBIGUOUS_REQUEST)).toBe(true)
    })
    
    it('should identify conflicting requirements', () => {
      const request = { content: 'Make the test cases comprehensive but also simple' }
      const context = { userPreferences: { testCaseFormat: 'gherkin' } }
      
      const assumptions = documentAssumptions(request, context)
      
      expect(assumptions.length).toBeGreaterThan(0)
      expect(assumptions.some(a => a.type === UncertaintyType.CONFLICTING_REQUIREMENTS)).toBe(true)
    })
  })
  
  describe('generatePartialResults', () => {
    it('should identify completed and missing sections', () => {
      const request = { content: 'Generate test cases' }
      const context = { 
        currentDocument: {
          ticketSummary: { problem: 'Issue', solution: 'Fix', context: 'App' },
          acceptanceCriteria: [{ title: 'Criteria 1' }],
          testCases: []
        }
      }
      
      const partialResult = generatePartialResults(request, context)
      
      expect(partialResult.completedSections).toContain('ticketSummary')
      expect(partialResult.completedSections).toContain('acceptanceCriteria')
      expect(partialResult.missingSections).toContain('testCases')
      expect(partialResult.fallbackContent).toBeDefined()
      expect(partialResult.fallbackContent.testCases).toBeDefined()
    })
    
    it('should handle errors', () => {
      const request = { content: 'Generate test cases' }
      const context = { currentDocument: {} }
      const error = new Error('Processing failed')
      
      const partialResult = generatePartialResults(request, context, error)
      
      expect(partialResult.reason).toContain('Processing failed')
      expect(partialResult.missingSections.length).toBeGreaterThan(0)
      expect(partialResult.fallbackContent).toBeDefined()
    })
  })
  
  describe('formatTryVerifyFeedbackResponse', () => {
    it('should format response with assumptions', () => {
      const response = 'Here are the test cases'
      const assumptions = [
        {
          type: UncertaintyType.MISSING_CONTEXT,
          description: 'No test case format specified',
          impact: 'medium'
        }
      ]
      
      const formatted = formatTryVerifyFeedbackResponse(response, assumptions)
      
      expect(formatted).toContain('Assumptions Made')
      expect(formatted).toContain('No test case format specified')
      expect(formatted).toContain('Here are the test cases')
      expect(formatted).toContain('Feedback')
    })
    
    it('should include clarifying questions', () => {
      const response = 'Here are the test cases'
      const assumptions = []
      const questions = [
        {
          question: 'What format would you prefer?',
          context: 'Format specification',
          options: ['Gherkin', 'Steps']
        }
      ]
      
      const formatted = formatTryVerifyFeedbackResponse(response, assumptions, questions)
      
      expect(formatted).toContain('Clarifying Questions')
      expect(formatted).toContain('What format would you prefer?')
      expect(formatted).toContain('Gherkin, Steps')
    })
  })
  
  describe('processAmbiguousRequest', () => {
    it('should process request with assumptions and clarifying questions', async () => {
      const request = { content: 'Improve the test cases' }
      const context = { userPreferences: {} }
      const processor = vi.fn().mockResolvedValue('Processed result')
      
      const result = await processAmbiguousRequest(request, context, processor)
      
      expect(processor).toHaveBeenCalledWith(request, context)
      expect(result).toContain('Assumptions Made')
      expect(result).toContain('Processed result')
      expect(result).toContain('Feedback')
    })
    
    it('should handle errors and return partial results', async () => {
      const request = { content: 'Generate test cases' }
      const context = { currentDocument: {} }
      const processor = vi.fn().mockRejectedValue(new Error('Processing failed'))
      
      const result = await processAmbiguousRequest(request, context, processor)
      
      expect(processor).toHaveBeenCalledWith(request, context)
      expect(result.partialResult).toBeDefined()
      expect(result.error).toBeDefined()
      expect(result.suggestions.length).toBeGreaterThan(0)
    })
    
    it('should add metadata for object responses', async () => {
      const request = { content: 'Generate test cases' }
      const context = { userPreferences: {} }
      const processor = vi.fn().mockResolvedValue({ 
        data: 'Processed result',
        metadata: { version: '1.0' }
      })
      
      const result = await processAmbiguousRequest(request, context, processor)
      
      expect(result.data).toBe('Processed result')
      expect(result.metadata).toBeDefined()
      expect(result.metadata.version).toBe('1.0')
      expect(result.metadata.assumptions).toBeDefined()
      expect(result.metadata.clarifyingQuestions).toBeDefined()
    })
  })
})