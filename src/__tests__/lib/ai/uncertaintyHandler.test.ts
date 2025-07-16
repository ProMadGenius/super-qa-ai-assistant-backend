/**
 * Uncertainty Handler Tests
 */

import {
  generateClarifyingQuestions,
  documentAssumptions,
  generatePartialResults,
  formatTryVerifyFeedbackResponse,
  processAmbiguousRequest,
  UncertaintyType,
  Assumption,
  ClarifyingQuestion
} from '../../../lib/ai/uncertaintyHandler';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the providerFailover module
vi.mock('../../../lib/ai/providerFailover', () => ({
  getProviderHealthStatus: vi.fn().mockReturnValue({
    openai: {
      name: 'openai',
      available: true,
      failureCount: 0,
      lastFailure: null,
      lastSuccess: new Date(),
      circuitOpen: false,
      circuitOpenTime: null
    },
    anthropic: {
      name: 'anthropic',
      available: true,
      failureCount: 0,
      lastFailure: null,
      lastSuccess: new Date(),
      circuitOpen: false,
      circuitOpenTime: null
    }
  }),
  resetCircuitBreaker: vi.fn().mockReturnValue(true),
  resetAllCircuitBreakers: vi.fn()
}));

describe('Uncertainty Handler', () => {
  describe('generateClarifyingQuestions', () => {
    test('should generate format-related questions', () => {
      const ambiguities = ['test case format'];
      const context = {};
      
      const questions = generateClarifyingQuestions(ambiguities, context);
      
      expect(questions).toHaveLength(1);
      expect(questions[0]).toMatchObject({
        question: expect.stringContaining('format'),
        options: expect.arrayContaining(['Gherkin', 'Step-by-step', 'Table format']),
        relatedTo: 'testCaseFormat'
      });
    });
    
    test('should generate category-related questions', () => {
      const ambiguities = ['testing category'];
      const context = {};
      
      const questions = generateClarifyingQuestions(ambiguities, context);
      
      expect(questions).toHaveLength(1);
      expect(questions[0]).toMatchObject({
        question: expect.stringContaining('categories'),
        options: expect.arrayContaining(['Functional', 'UI/UX', 'API']),
        relatedTo: 'qaCategories'
      });
    });
    
    test('should generate priority-related questions', () => {
      const ambiguities = ['test priority'];
      const context = {};
      
      const questions = generateClarifyingQuestions(ambiguities, context);
      
      expect(questions).toHaveLength(1);
      expect(questions[0]).toMatchObject({
        question: expect.stringContaining('priority'),
        options: expect.arrayContaining(['Critical', 'High', 'Medium', 'Low']),
        relatedTo: 'priority'
      });
    });
    
    test('should generate generic questions for unknown ambiguities', () => {
      const ambiguities = ['unknown ambiguity'];
      const context = {};
      
      const questions = generateClarifyingQuestions(ambiguities, context);
      
      expect(questions).toHaveLength(1);
      expect(questions[0]).toMatchObject({
        question: expect.stringContaining('unknown ambiguity'),
        context: 'General clarification',
        relatedTo: 'general'
      });
    });
  });
  
  describe('documentAssumptions', () => {
    test('should document missing test case format', () => {
      const request = {};
      const context = { userPreferences: {} };
      
      const assumptions = documentAssumptions(request, context);
      
      expect(assumptions).toContainEqual(expect.objectContaining({
        type: UncertaintyType.MISSING_CONTEXT,
        description: expect.stringContaining('test case format'),
        alternatives: expect.arrayContaining(['Step-by-step', 'Table format'])
      }));
    });
    
    test('should document vague terms in request', () => {
      const request = { content: 'Please improve the test cases' };
      const context = { userPreferences: { testCaseFormat: 'gherkin' } };
      
      const assumptions = documentAssumptions(request, context);
      
      expect(assumptions).toContainEqual(expect.objectContaining({
        type: UncertaintyType.AMBIGUOUS_REQUEST,
        description: expect.stringContaining('vague term'),
        confidence: expect.any(Number)
      }));
    });
    
    test('should document conflicting requirements', () => {
      const request = { content: 'Make the tests comprehensive but also simple' };
      const context = { userPreferences: { testCaseFormat: 'gherkin' } };
      
      const assumptions = documentAssumptions(request, context);
      
      expect(assumptions).toContainEqual(expect.objectContaining({
        type: UncertaintyType.CONFLICTING_REQUIREMENTS,
        description: expect.stringContaining('comprehensive') && expect.stringContaining('simple'),
        impact: 'high'
      }));
    });
  });
  
  describe('generatePartialResults', () => {
    test('should generate partial results with completed sections', () => {
      const request = {};
      const context = {
        currentDocument: {
          ticketSummary: { problem: 'Test problem', solution: 'Test solution', context: 'Test context' },
          acceptanceCriteria: [{ title: 'Test criterion' }],
          testCases: []
        }
      };
      
      const partialResult = generatePartialResults(request, context);
      
      expect(partialResult.completedSections).toContain('ticketSummary');
      expect(partialResult.completedSections).toContain('acceptanceCriteria');
      expect(partialResult.missingSections).toContain('testCases');
      expect(partialResult.fallbackContent).toHaveProperty('testCases');
    });
    
    test('should include error reason when provided', () => {
      const request = {};
      const context = { currentDocument: {} };
      const error = new Error('Test error');
      
      const partialResult = generatePartialResults(request, context, error);
      
      expect(partialResult.reason).toContain('Test error');
      expect(partialResult.missingSections).toContain('ticketSummary');
      expect(partialResult.missingSections).toContain('acceptanceCriteria');
      expect(partialResult.missingSections).toContain('testCases');
    });
  });
  
  describe('formatTryVerifyFeedbackResponse', () => {
    test('should format response with assumptions', () => {
      const response = 'Test response';
      const assumptions: Assumption[] = [
        {
          type: UncertaintyType.MISSING_CONTEXT,
          description: 'Test assumption',
          impact: 'medium'
        }
      ];
      
      const formattedResponse = formatTryVerifyFeedbackResponse(response, assumptions);
      
      expect(formattedResponse).toContain('## Assumptions Made');
      expect(formattedResponse).toContain('Test assumption');
      expect(formattedResponse).toContain('Impact: medium');
      expect(formattedResponse).toContain('Test response');
      expect(formattedResponse).toContain('## Feedback');
    });
    
    test('should format response with clarifying questions', () => {
      const response = 'Test response';
      const assumptions: Assumption[] = [];
      const clarifyingQuestions: ClarifyingQuestion[] = [
        {
          question: 'Test question?',
          context: 'Test context',
          options: ['Option 1', 'Option 2']
        }
      ];
      
      const formattedResponse = formatTryVerifyFeedbackResponse(response, assumptions, clarifyingQuestions);
      
      expect(formattedResponse).not.toContain('## Assumptions Made');
      expect(formattedResponse).toContain('Test response');
      expect(formattedResponse).toContain('## Clarifying Questions');
      expect(formattedResponse).toContain('Test question?');
      expect(formattedResponse).toContain('Options: Option 1, Option 2');
      expect(formattedResponse).toContain('## Feedback');
    });
  });
  
  describe('processAmbiguousRequest', () => {
    test('should process request successfully with assumptions and clarifying questions', async () => {
      const request = { content: 'Test request' };
      const context = { userPreferences: {} };
      const processor = vi.fn().mockResolvedValue('Test result');
      
      const result = await processAmbiguousRequest(request, context, processor);
      
      expect(processor).toHaveBeenCalledWith(request, context);
      expect(result).toContain('Test result');
      expect(result).toContain('## Assumptions Made');
      expect(result).toContain('## Feedback');
    });
    
    test('should handle object results by adding metadata', async () => {
      const request = { content: 'Test request' };
      const context = { userPreferences: {} };
      const processor = vi.fn().mockResolvedValue({ data: 'Test data', metadata: { existing: true } });
      
      const result = await processAmbiguousRequest(request, context, processor);
      
      expect(processor).toHaveBeenCalledWith(request, context);
      expect(result).toHaveProperty('data', 'Test data');
      expect(result).toHaveProperty('metadata.existing', true);
      expect(result).toHaveProperty('metadata.assumptions');
      expect(result).toHaveProperty('metadata.clarifyingQuestions');
      expect(result).toHaveProperty('metadata.processingNotes');
      expect(result).toHaveProperty('metadata.processingDetails');
    });
    
    test('should handle provider failover errors', async () => {
      const request = { content: 'Test request' };
      const context = { userPreferences: {} };
      const processor = vi.fn().mockRejectedValue(new Error('All providers failed after retries'));
      
      const result = await processAmbiguousRequest(request, context, processor);
      
      expect(processor).toHaveBeenCalledWith(request, context);
      expect(result).toHaveProperty('partialResult');
      expect(result).toHaveProperty('error', 'Unable to process the request due to AI provider issues');
      expect(result).toHaveProperty('errorType', 'PROVIDER_ERROR');
      expect(result.suggestions).toContain('Try again in a few moments');
      expect(result.suggestions).toContain('The system will automatically attempt to use alternative providers');
    });
    
    test('should handle ambiguity errors', async () => {
      const request = { content: 'Test request' };
      const context = { userPreferences: {} };
      const processor = vi.fn().mockRejectedValue(new Error('Ambiguous request'));
      
      const result = await processAmbiguousRequest(request, context, processor);
      
      expect(processor).toHaveBeenCalledWith(request, context);
      expect(result).toHaveProperty('partialResult');
      expect(result).toHaveProperty('error', 'Unable to fully process the request due to ambiguity or missing information');
      expect(result).toHaveProperty('errorType', 'AMBIGUITY_ERROR');
      expect(result.suggestions).toContain('Try providing more specific information');
    });
  });
});