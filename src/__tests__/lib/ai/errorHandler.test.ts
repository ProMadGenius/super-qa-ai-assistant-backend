/**
 * Error Handler Tests
 */

import { handleAIError, AIErrorType, handleValidationError } from '../../../lib/ai/errorHandler';
import { NextResponse } from 'next/server';
import { getProviderHealthStatus, resetAllCircuitBreakers } from '../../../lib/ai/providerFailover';
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

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn().mockImplementation((body, options) => ({
      body,
      options,
      status: options?.status || 200
    }))
  }
}));

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllCircuitBreakers();
  });

  describe('handleAIError', () => {
    test('should handle circuit breaker errors', () => {
      const error = new Error('No available AI providers. All circuits are open');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.CIRCUIT_OPEN_ERROR,
          message: 'All AI providers are currently unavailable',
          requestId: '123',
          providerStatus: expect.any(Object)
        }),
        { status: 503 }
      );
      
      expect(getProviderHealthStatus).toHaveBeenCalled();
    });
    
    test('should handle failover errors', () => {
      const error = new Error('All providers failed after retries');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.FAILOVER_ERROR,
          message: 'All AI provider failover attempts failed',
          requestId: '123',
          providerStatus: expect.any(Object)
        }),
        { status: 502 }
      );
      
      expect(getProviderHealthStatus).toHaveBeenCalled();
    });
    
    test('should handle rate limit errors and update provider status', () => {
      const error = new Error('OpenAI API rate limit exceeded');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.RATE_LIMIT_ERROR,
          message: 'AI service rate limit exceeded',
          provider: 'openai',
          providerStatus: expect.any(Object)
        }),
        { status: 429 }
      );
      
      expect(getProviderHealthStatus).toHaveBeenCalled();
    });
    
    test('should handle generation errors with provider status', () => {
      const error = new Error('AI_NoObjectGeneratedError: Failed to generate object');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.AI_GENERATION_ERROR,
          message: 'Failed to generate structured QA documentation',
          providerStatus: expect.any(Object)
        }),
        { status: 500 }
      );
      
      expect(getProviderHealthStatus).toHaveBeenCalled();
    });
    
    test('should handle authentication errors', () => {
      const error = new Error('Authentication failed with OpenAI API key');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication failed with AI provider',
          provider: 'openai'
        }),
        { status: 401 }
      );
    });
    
    test('should handle timeout errors', () => {
      const error = new Error('Request timed out after 60 seconds');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.TIMEOUT_ERROR,
          message: 'AI request timed out'
        }),
        { status: 504 }
      );
    });
    
    test('should handle content filter errors', () => {
      const error = new Error('Content filtered by OpenAI moderation policy');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.CONTENT_FILTER_ERROR,
          message: 'Content filtered by AI provider'
        }),
        { status: 422 }
      );
    });
    
    test('should handle provider-specific errors', () => {
      const error = new Error('OpenAI service error');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.PROVIDER_ERROR,
          message: 'AI provider service error',
          provider: 'openai'
        }),
        { status: 502 }
      );
    });
    
    test('should handle generic errors', () => {
      const error = new Error('Unknown error');
      const requestId = '123';
      
      const response = handleAIError(error, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred while processing your request'
        }),
        { status: 500 }
      );
    });
  });
  
  describe('handleValidationError', () => {
    test('should format validation errors correctly', () => {
      const issues = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['qaProfile', 'testCaseFormat'],
          message: 'Required'
        },
        {
          code: 'invalid_enum_value',
          expected: ['gherkin', 'steps', 'table'],
          received: 'invalid',
          path: ['qaProfile', 'testCaseFormat'],
          message: 'Invalid enum value'
        }
      ];
      
      const requestId = '123';
      
      const response = handleValidationError(issues, requestId);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: AIErrorType.VALIDATION_ERROR,
          message: 'Invalid request payload',
          details: expect.objectContaining({
            issues: expect.arrayContaining([
              expect.objectContaining({
                field: 'qaProfile.testCaseFormat',
                message: 'Required'
              }),
              expect.objectContaining({
                field: 'qaProfile.testCaseFormat',
                message: 'Invalid enum value'
              })
            ])
          })
        }),
        { status: 400 }
      );
    });
  });
});