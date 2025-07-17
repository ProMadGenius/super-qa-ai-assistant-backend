/**
 * Comprehensive tests for suggestion algorithms
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { 
  analyzeCoverageGaps,
  identifyEdgeCases,
  generateClarificationQuestions,
  generateSuggestions,
  prioritizeSuggestions,
  filterSuggestionsByType
} from '../../../lib/ai/suggestionAlgorithms';
import { createMinimalQACanvasDocument } from '../../../lib/schemas/QACanvasDocument';
import { defaultQAProfile } from '../../../lib/schemas/QAProfile';
import { createQASuggestion } from '../../../lib/schemas/QASuggestion';

// Mock AI functions
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn().mockImplementation((config) => ({
    ...config,
    _isTool: true
  }))
}));

import { generateText } from 'ai';

describe('Suggestion Algorithms', () => {
  // Sample test data
  const sampleDocument = createMinimalQACanvasDocument('TEST-123', defaultQAProfile);
  
  // Update sample document with more realistic data
  sampleDocument.ticketSummary = {
    problem: 'Users cannot reset their password when using special characters',
    solution: 'Update password reset functionality to handle special characters correctly',
    context: 'The password reset feature is critical for user account management'
  };
  
  sampleDocument.acceptanceCriteria = [
    {
      id: 'ac-1',
      title: 'Password reset with special characters',
      description: 'System should allow password reset with special characters',
      priority: 'must',
      category: 'functional',
      testable: true
    }
  ];
  
  sampleDocument.testCases = [
    {
      format: 'steps',
      id: 'tc-1',
      category: 'functional',
      priority: 'high',
      testCase: {
        title: 'Reset password with special characters',
        objective: 'Verify that users can reset passwords containing special characters',
        preconditions: ['User account exists', 'User has access to email'],
        steps: [
          {
            stepNumber: 1,
            action: 'Navigate to password reset page',
            expectedResult: 'Password reset page loads'
          },
          {
            stepNumber: 2,
            action: 'Enter email address',
            expectedResult: 'Email field accepts input'
          },
          {
            stepNumber: 3,
            action: 'Submit reset request',
            expectedResult: 'Reset email is sent'
          },
          {
            stepNumber: 4,
            action: 'Open email and click reset link',
            expectedResult: 'Reset password page opens'
          },
          {
            stepNumber: 5,
            action: 'Enter new password with special characters',
            expectedResult: 'Password field accepts special characters'
          },
          {
            stepNumber: 6,
            action: 'Confirm password reset',
            expectedResult: 'Password is successfully reset'
          }
        ],
        postconditions: ['User can login with new password']
      }
    }
  ];

  // Sample suggestions
  const sampleSuggestions = [
    createQASuggestion({
      suggestionType: 'edge_case',
      title: 'Test password reset with extremely long passwords',
      description: 'Add a test case for passwords that are at the maximum allowed length',
      priority: 'medium',
      reasoning: 'Edge cases around password length limits are common sources of bugs',
      relatedRequirements: ['ac-1'],
      tags: ['password', 'edge-case', 'validation']
    }),
    createQASuggestion({
      suggestionType: 'ui_verification',
      title: 'Verify error message display for invalid password formats',
      description: 'Add UI verification for error message styling and placement',
      priority: 'low',
      reasoning: 'Error messages should be clearly visible and properly styled',
      relatedRequirements: ['ac-1'],
      tags: ['ui', 'error-handling', 'validation']
    }),
    createQASuggestion({
      suggestionType: 'clarification_question',
      title: 'What specific special characters need to be supported?',
      description: 'Clarify which special characters are required for password reset',
      priority: 'high',
      reasoning: 'The requirements do not specify which special characters must be supported',
      relatedRequirements: ['ac-1'],
      tags: ['requirements', 'clarification']
    })
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should generate suggestions successfully', async () => {
    // Mock the AI function
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify({
      suggestions: sampleSuggestions
    }));
    
    const result = await generateSuggestions(
      sampleDocument,
      { maxSuggestions: 3 }
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0].suggestionType).toBe('edge_case');
    expect(result.suggestions[1].suggestionType).toBe('ui_verification');
    expect(result.suggestions[2].suggestionType).toBe('clarification_question');
    
    // Verify the AI function was called correctly
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Generate QA suggestions'),
      tools: expect.objectContaining({
        qaSuggestionTool: expect.any(Object)
      })
    }));
  });

  test('should analyze coverage gaps', () => {
    const result = analyzeCoverageGaps(sampleDocument);
    
    expect(result).toBeDefined();
    expect(result.gaps).toBeInstanceOf(Array);
    
    // The sample document only has functional tests, so should identify gaps
    expect(result.gaps).toContain('negative_testing');
    expect(result.gaps).toContain('ui_testing');
    
    // Should identify covered areas
    expect(result.coveredAreas).toContain('functional_testing');
    expect(result.coveredAreas).toContain('password_reset');
    
    // Should calculate coverage percentage
    expect(result.coveragePercentage).toBeGreaterThan(0);
    expect(result.coveragePercentage).toBeLessThan(100);
  });

  test('should identify edge cases', () => {
    const result = identifyEdgeCases(sampleDocument);
    
    expect(result).toBeDefined();
    expect(result.edgeCases).toBeInstanceOf(Array);
    
    // Should identify potential edge cases for password reset
    expect(result.edgeCases.length).toBeGreaterThan(0);
    
    // Check for common password reset edge cases
    const edgeCaseTypes = result.edgeCases.map(ec => ec.type);
    expect(edgeCaseTypes).toContain('boundary_condition');
    expect(edgeCaseTypes).toContain('input_validation');
    
    // Should provide suggestions for each edge case
    expect(result.edgeCases[0].suggestion).toBeDefined();
  });

  test('should generate clarification questions', () => {
    const result = generateClarificationQuestions(sampleDocument);
    
    expect(result).toBeDefined();
    expect(result.questions).toBeInstanceOf(Array);
    expect(result.questions.length).toBeGreaterThan(0);
    
    // Should identify areas needing clarification
    expect(result.unclearAreas).toBeInstanceOf(Array);
    
    // Should provide context for each question
    expect(result.questions[0].context).toBeDefined();
    expect(result.questions[0].question).toBeDefined();
  });

  test('should prioritize suggestions', () => {
    const result = prioritizeSuggestions(sampleSuggestions, sampleDocument);
    
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(3);
    
    // Should be sorted by priority (high to low)
    expect(result[0].priority).toBe('high');
    expect(result[1].priority).toBe('medium');
    expect(result[2].priority).toBe('low');
    
    // Should have relevance scores
    expect(result[0].relevanceScore).toBeDefined();
    expect(result[0].relevanceScore).toBeGreaterThan(0);
  });

  test('should filter suggestions by type', () => {
    // Filter for edge cases only
    const edgeCases = filterSuggestionsByType(sampleSuggestions, ['edge_case']);
    expect(edgeCases).toHaveLength(1);
    expect(edgeCases[0].suggestionType).toBe('edge_case');
    
    // Filter for UI and clarification questions
    const uiAndQuestions = filterSuggestionsByType(sampleSuggestions, ['ui_verification', 'clarification_question']);
    expect(uiAndQuestions).toHaveLength(2);
    expect(uiAndQuestions[0].suggestionType).toBe('ui_verification');
    expect(uiAndQuestions[1].suggestionType).toBe('clarification_question');
    
    // Filter with no matches
    const noMatches = filterSuggestionsByType(sampleSuggestions, ['performance_test']);
    expect(noMatches).toHaveLength(0);
  });

  test('should handle AI errors during suggestion generation', async () => {
    // Mock the AI function to throw an error
    (generateText as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI service unavailable')
    );
    
    const result = await generateSuggestions(
      sampleDocument,
      { maxSuggestions: 3 }
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('AI service unavailable');
    expect(result.suggestions).toEqual([]);
  });

  test('should handle invalid AI responses', async () => {
    // Mock the AI function to return invalid JSON
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('Not valid JSON');
    
    const result = await generateSuggestions(
      sampleDocument,
      { maxSuggestions: 3 }
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.suggestions).toEqual([]);
  });

  test('should respect maxSuggestions parameter', async () => {
    // Create a larger set of suggestions
    const manySuggestions = [
      ...sampleSuggestions,
      createQASuggestion({
        suggestionType: 'functional_test',
        title: 'Test password reset email expiration',
        description: 'Add a test case for password reset link expiration',
        priority: 'medium',
        reasoning: 'Security feature that should be tested',
        relatedRequirements: ['ac-1'],
        tags: ['password', 'security', 'expiration']
      }),
      createQASuggestion({
        suggestionType: 'negative_test',
        title: 'Test password reset with invalid token',
        description: 'Add a negative test for invalid reset tokens',
        priority: 'medium',
        reasoning: 'Security validation is important',
        relatedRequirements: ['ac-1'],
        tags: ['password', 'security', 'negative']
      })
    ];
    
    // Mock the AI function
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify({
      suggestions: manySuggestions
    }));
    
    // Request only 2 suggestions
    const result = await generateSuggestions(
      sampleDocument,
      { maxSuggestions: 2 }
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.suggestions).toHaveLength(2); // Should be limited to 2
  });

  test('should handle empty document gracefully', async () => {
    const emptyDocument = createMinimalQACanvasDocument('EMPTY-123', defaultQAProfile);
    
    // Mock the AI function
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify({
      suggestions: [
        createQASuggestion({
          suggestionType: 'clarification_question',
          title: 'What is the purpose of this ticket?',
          description: 'The ticket lacks details about its purpose',
          priority: 'high',
          reasoning: 'Cannot generate meaningful tests without understanding the purpose',
          relatedRequirements: [],
          tags: ['requirements', 'clarification']
        })
      ]
    }));
    
    const result = await generateSuggestions(
      emptyDocument,
      { maxSuggestions: 3 }
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].suggestionType).toBe('clarification_question');
  });

  test('should include focus areas in prompt when specified', async () => {
    // Mock the AI function
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify({
      suggestions: sampleSuggestions
    }));
    
    await generateSuggestions(
      sampleDocument,
      { 
        maxSuggestions: 3,
        focusAreas: ['security', 'performance']
      }
    );
    
    // Verify the AI function was called with focus areas in the prompt
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Focus on these areas: security, performance')
    }));
  });

  test('should exclude specified suggestion types when requested', async () => {
    // Mock the AI function
    (generateText as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify({
      suggestions: sampleSuggestions
    }));
    
    await generateSuggestions(
      sampleDocument,
      { 
        maxSuggestions: 3,
        excludeTypes: ['clarification_question']
      }
    );
    
    // Verify the AI function was called with exclude types in the prompt
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Exclude these suggestion types: clarification_question')
    }));
  });
});