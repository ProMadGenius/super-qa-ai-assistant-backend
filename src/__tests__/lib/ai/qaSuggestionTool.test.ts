/**
 * Tests for QA Suggestion Tool
 */

import { describe, test, expect } from 'vitest';
import {
  qaSuggestionTool,
  validateQASuggestion,
  validateQASuggestionsResponse,
  validateGenerateSuggestionsRequest,
  createQASuggestion
} from '../../../lib/schemas/QASuggestion';

describe('QA Suggestion Tool', () => {
  test('should have correct tool definition structure', () => {
    expect(qaSuggestionTool).toBeDefined();
    expect(qaSuggestionTool.description).toBeDefined();
    expect(qaSuggestionTool.description).toContain('Generate a single, actionable QA suggestion');
    expect(qaSuggestionTool.parameters).toBeDefined();
  });

  test('should have required parameters defined', () => {
    const parameters = qaSuggestionTool.parameters;
    expect(parameters.shape).toBeDefined();

    // Check required parameters
    expect(parameters.shape.suggestionType).toBeDefined();
    expect(parameters.shape.title).toBeDefined();
    expect(parameters.shape.description).toBeDefined();
    expect(parameters.shape.reasoning).toBeDefined();

    // Check optional parameters
    expect(parameters.shape.targetSection).toBeDefined();
    expect(parameters.shape.priority).toBeDefined();
    expect(parameters.shape.implementationHint).toBeDefined();
    expect(parameters.shape.estimatedEffort).toBeDefined();
    expect(parameters.shape.tags).toBeDefined();
  });

  test('should validate valid suggestion data', () => {
    const validSuggestion = {
      id: 'test-123',
      suggestionType: 'edge_case',
      title: 'Test edge case: Session timeout during operation',
      description: 'Add a test case for the edge case: Session timeout during operation',
      targetSection: 'Test Cases',
      priority: 'high',
      reasoning: 'User session expires while performing an action',
      implementationHint: 'Create a test that specifically verifies behavior for this edge case scenario.',
      estimatedEffort: 'medium',
      relatedRequirements: [],
      tags: ['edge-case', 'session-management']
    };

    const result = validateQASuggestion(validSuggestion);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validSuggestion);
    }
  });

  test('should reject invalid suggestion data', () => {
    const invalidSuggestion = {
      id: 'test-123',
      suggestionType: 'invalid_type', // Invalid enum value
      title: 'Test edge case',
      description: 'Add a test case',
      priority: 'critical', // Invalid enum value
      reasoning: 'Important test'
    };

    const result = validateQASuggestion(invalidSuggestion);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);

      // Check specific validation errors
      const issues = result.error.issues;
      const suggestionTypeIssue = issues.find(issue => issue.path.includes('suggestionType'));
      const priorityIssue = issues.find(issue => issue.path.includes('priority'));

      expect(suggestionTypeIssue).toBeDefined();
      expect(priorityIssue).toBeDefined();
    }
  });

  test('should validate suggestions response', () => {
    const validResponse = {
      suggestions: [
        {
          id: 'test-123',
          suggestionType: 'edge_case',
          title: 'Test edge case',
          description: 'Add a test case',
          priority: 'high',
          reasoning: 'Important test',
          tags: []
        }
      ],
      totalCount: 1,
      generatedAt: new Date().toISOString(),
      contextSummary: 'Test context'
    };

    const result = validateQASuggestionsResponse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggestions.length).toBe(1);
      expect(result.data.totalCount).toBe(1);
    }
  });

  test('should validate generate suggestions request', () => {
    const validRequest = {
      currentDocument: JSON.stringify({ ticketSummary: { problem: 'Test problem' } }),
      maxSuggestions: 5,
      focusAreas: ['edge_case', 'ui_verification'],
      excludeTypes: ['clarification_question'],
      requestId: 'req-123'
    };

    const result = validateGenerateSuggestionsRequest(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxSuggestions).toBe(5);
      expect(result.data.focusAreas).toContain('edge_case');
      expect(result.data.excludeTypes).toContain('clarification_question');
    }
  });

  test('should reject invalid generate suggestions request', () => {
    const invalidRequest = {
      currentDocument: JSON.stringify({ ticketSummary: { problem: 'Test problem' } }),
      maxSuggestions: 20, // Exceeds max of 10
      focusAreas: ['invalid_area'], // Invalid enum value
    };

    const result = validateGenerateSuggestionsRequest(invalidRequest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);

      // Check specific validation errors
      const issues = result.error.issues;
      const maxSuggestionsIssue = issues.find(issue => issue.path.includes('maxSuggestions'));
      const focusAreasIssue = issues.find(issue => issue.path.includes('focusAreas'));

      expect(maxSuggestionsIssue).toBeDefined();
      expect(focusAreasIssue).toBeDefined();
    }
  });

  test('should create QA suggestion with auto-generated ID', () => {
    const suggestionData = {
      suggestionType: 'edge_case' as const,
      title: 'Test edge case',
      description: 'Add a test case',
      priority: 'high' as const,
      reasoning: 'Important test',
      relatedRequirements: [],
      tags: []
    };

    const suggestion = createQASuggestion(suggestionData);
    expect(suggestion.id).toBeDefined();
    expect(suggestion.id).toMatch(/^suggestion-\d+-[a-z0-9]+$/);
    expect(suggestion.suggestionType).toBe('edge_case');
    expect(suggestion.title).toBe('Test edge case');
  });

  test('should handle all suggestion types', () => {
    const suggestionTypes = [
      'edge_case',
      'ui_verification',
      'functional_test',
      'clarification_question',
      'negative_test',
      'performance_test',
      'security_test',
      'accessibility_test',
      'integration_test',
      'data_validation'
    ] as const;

    // Test each suggestion type
    suggestionTypes.forEach(type => {
      const suggestion = createQASuggestion({
        suggestionType: type,
        title: `Test ${type}`,
        description: `Add a test case for ${type}`,
        priority: 'medium',
        reasoning: `Important ${type} test`,
        relatedRequirements: [],
        tags: [type]
      });

      const result = validateQASuggestion(suggestion);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suggestionType).toBe(type);
      }
    });
  });

  test('should handle all priority levels', () => {
    const priorities = ['high', 'medium', 'low'] as const;

    // Test each priority level
    priorities.forEach(priority => {
      const suggestion = createQASuggestion({
        suggestionType: 'edge_case',
        title: `Test with ${priority} priority`,
        description: 'Add a test case',
        priority: priority,
        reasoning: 'Important test',
        relatedRequirements: [],
        tags: []
      });

      const result = validateQASuggestion(suggestion);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(priority);
      }
    });
  });

  test('should handle all effort levels', () => {
    const effortLevels = ['low', 'medium', 'high'] as const;

    // Test each effort level
    effortLevels.forEach(effort => {
      const suggestion = createQASuggestion({
        suggestionType: 'edge_case',
        title: `Test with ${effort} effort`,
        description: 'Add a test case',
        priority: 'medium',
        reasoning: 'Important test',
        estimatedEffort: effort,
        relatedRequirements: [],
        tags: []
      });

      const result = validateQASuggestion(suggestion);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedEffort).toBe(effort);
      }
    });
  });
});