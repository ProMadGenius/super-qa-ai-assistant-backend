/**
 * Comprehensive tests for uncertainty handler
 */

import { describe, test, expect, vi } from 'vitest';
import { 
  handleAmbiguousRequest,
  generateClarifyingQuestions,
  documentAssumptions,
  tryVerifyFeedbackPattern,
  gracefulDegradation,
  detectUncertainty
} from '../../../lib/ai/uncertaintyHandler';

describe('Uncertainty Handler', () => {
  test('should handle ambiguous requests', async () => {
    // Mock the AI function
    const mockAIFunction = vi.fn().mockResolvedValue({
      response: 'I have processed your ambiguous request with these assumptions...',
      assumptions: ['Assumed you meant X', 'Assumed context Y']
    });
    
    const result = await handleAmbiguousRequest(
      'ambiguous request',
      mockAIFunction,
      { context: 'some context' }
    );
    
    expect(result).toBeDefined();
    expect(result.response).toContain('processed your ambiguous request');
    expect(result.assumptions).toBeInstanceOf(Array);
    expect(result.assumptions).toHaveLength(2);
    expect(mockAIFunction).toHaveBeenCalledWith('ambiguous request', { context: 'some context' });
  });

  test('should generate clarifying questions', async () => {
    // Mock the AI function
    const mockAIFunction = vi.fn().mockResolvedValue([
      'What specific aspect of the feature do you want to test?',
      'Are you looking for positive or negative test cases?',
      'Should these tests be automated or manual?'
    ]);
    
    const result = await generateClarifyingQuestions(
      'unclear request',
      mockAIFunction,
      { maxQuestions: 3 }
    );
    
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain('specific aspect');
    expect(mockAIFunction).toHaveBeenCalledWith('unclear request', { maxQuestions: 3 });
  });

  test('should document assumptions', () => {
    const assumptions = [
      'Assumed you want Gherkin format',
      'Assumed functional testing is the priority',
      'Assumed API tests are not needed'
    ];
    
    const result = documentAssumptions(assumptions);
    
    expect(result).toBeDefined();
    expect(result).toContain('Based on your request, I made the following assumptions:');
    expect(result).toContain('Assumed you want Gherkin format');
    expect(result).toContain('Assumed functional testing is the priority');
    expect(result).toContain('Assumed API tests are not needed');
    expect(result).toContain('Please let me know if any of these assumptions are incorrect');
  });

  test('should implement try-verify-feedback pattern', async () => {
    // Mock the AI function
    const mockAIFunction = vi.fn().mockImplementation(async (request, options) => {
      if (options?.mode === 'try') {
        return {
          response: 'Here is my best attempt...',
          assumptions: ['Assumed X', 'Assumed Y'],
          confidence: 0.7
        };
      } else if (options?.mode === 'verify') {
        return {
          valid: true,
          issues: []
        };
      }
      return null;
    });
    
    const result = await tryVerifyFeedbackPattern(
      'ambiguous request',
      mockAIFunction
    );
    
    expect(result).toBeDefined();
    expect(result.response).toContain('Here is my best attempt');
    expect(result.assumptions).toBeInstanceOf(Array);
    expect(result.assumptions).toHaveLength(2);
    expect(result.verified).toBe(true);
    expect(result.issues).toEqual([]);
    
    // Verify the function was called twice (try + verify)
    expect(mockAIFunction).toHaveBeenCalledTimes(2);
    expect(mockAIFunction).toHaveBeenNthCalledWith(1, 'ambiguous request', { mode: 'try' });
    expect(mockAIFunction).toHaveBeenNthCalledWith(2, expect.any(String), { mode: 'verify' });
  });

  test('should handle graceful degradation', async () => {
    // Mock the AI function that fails for complete processing
    const mockCompleteFunction = vi.fn().mockRejectedValue(new Error('Failed to process'));
    
    // Mock the AI function that succeeds for partial processing
    const mockPartialFunction = vi.fn().mockResolvedValue({
      partial: true,
      result: 'Partial result',
      completedSections: ['section1', 'section2'],
      missingSections: ['section3']
    });
    
    const result = await gracefulDegradation(
      'complex request',
      mockCompleteFunction,
      mockPartialFunction
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.partial).toBe(true);
    expect(result.result).toBe('Partial result');
    expect(result.completedSections).toEqual(['section1', 'section2']);
    expect(result.missingSections).toEqual(['section3']);
    expect(result.error).toBeUndefined();
    
    // Verify the functions were called correctly
    expect(mockCompleteFunction).toHaveBeenCalledWith('complex request');
    expect(mockPartialFunction).toHaveBeenCalledWith('complex request');
  });

  test('should detect uncertainty in AI responses', () => {
    // Test responses with uncertainty
    const uncertainResponses = [
      "I'm not sure if this is what you're looking for...",
      "It's unclear what you mean by...",
      "I don't have enough information to...",
      "This could be interpreted in multiple ways...",
      "Without more context, I'm assuming..."
    ];
    
    uncertainResponses.forEach(response => {
      const result = detectUncertainty(response);
      expect(result.uncertain).toBe(true);
      expect(result.confidenceScore).toBeLessThan(0.5);
    });
    
    // Test responses without uncertainty
    const certainResponses = [
      "Here are the test cases you requested.",
      "I've created the acceptance criteria based on your requirements.",
      "The following test plan addresses all your needs.",
      "These edge cases cover the scenarios you mentioned."
    ];
    
    certainResponses.forEach(response => {
      const result = detectUncertainty(response);
      expect(result.uncertain).toBe(false);
      expect(result.confidenceScore).toBeGreaterThan(0.5);
    });
  });

  test('should handle failed graceful degradation', async () => {
    // Mock both functions to fail
    const mockCompleteFunction = vi.fn().mockRejectedValue(new Error('Complete processing failed'));
    const mockPartialFunction = vi.fn().mockRejectedValue(new Error('Partial processing failed'));
    
    const result = await gracefulDegradation(
      'complex request',
      mockCompleteFunction,
      mockPartialFunction
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Partial processing failed');
  });

  test('should handle successful complete processing', async () => {
    // Mock complete function to succeed
    const mockCompleteFunction = vi.fn().mockResolvedValue({
      complete: true,
      result: 'Complete result'
    });
    
    // Mock partial function (should not be called)
    const mockPartialFunction = vi.fn();
    
    const result = await gracefulDegradation(
      'complex request',
      mockCompleteFunction,
      mockPartialFunction
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.partial).toBe(false);
    expect(result.result).toBe('Complete result');
    
    // Verify only the complete function was called
    expect(mockCompleteFunction).toHaveBeenCalledWith('complex request');
    expect(mockPartialFunction).not.toHaveBeenCalled();
  });

  test('should generate appropriate number of clarifying questions', async () => {
    // Mock the AI function
    const mockAIFunction = vi.fn().mockResolvedValue([
      'Question 1?',
      'Question 2?',
      'Question 3?',
      'Question 4?',
      'Question 5?'
    ]);
    
    // Test with default max questions (3)
    const defaultResult = await generateClarifyingQuestions(
      'unclear request',
      mockAIFunction
    );
    
    expect(defaultResult).toHaveLength(3);
    
    // Test with custom max questions
    const customResult = await generateClarifyingQuestions(
      'unclear request',
      mockAIFunction,
      { maxQuestions: 5 }
    );
    
    expect(customResult).toHaveLength(5);
  });

  test('should handle empty assumptions', () => {
    const result = documentAssumptions([]);
    
    expect(result).toBe('');
  });

  test('should handle try-verify-feedback with verification failure', async () => {
    // Mock the AI function
    const mockAIFunction = vi.fn().mockImplementation(async (request, options) => {
      if (options?.mode === 'try') {
        return {
          response: 'Here is my best attempt...',
          assumptions: ['Assumed X', 'Assumed Y'],
          confidence: 0.7
        };
      } else if (options?.mode === 'verify') {
        return {
          valid: false,
          issues: ['Issue 1', 'Issue 2']
        };
      }
      return null;
    });
    
    const result = await tryVerifyFeedbackPattern(
      'ambiguous request',
      mockAIFunction
    );
    
    expect(result).toBeDefined();
    expect(result.response).toContain('Here is my best attempt');
    expect(result.verified).toBe(false);
    expect(result.issues).toEqual(['Issue 1', 'Issue 2']);
  });
});