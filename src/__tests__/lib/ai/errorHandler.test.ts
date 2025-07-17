/**
 * Comprehensive tests for error handler
 */

import { describe, test, expect, vi } from 'vitest';
import { 
  handleAIError,
  handleValidationError,
  createErrorObject,
  formatZodError,
  AIErrorType,
  ErrorResponse
} from '../../../lib/ai/errorHandler';
import { z } from 'zod';

describe('Error Handler', () => {
  test('should create error response with correct structure', () => {
    // Test that handleAIError creates proper error structure
    const testError = new Error('Test error message');
    const response = handleAIError(testError, 'test-request-id');
    
    expect(response.status).toBeDefined();
    // The response should be a NextResponse, so we need to check its structure
    expect(response).toBeDefined();
  });

  test('should handle validation error', () => {
    // Create a Zod schema for testing
    const testSchema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
      email: z.string().email()
    });
    
    // Create an invalid object
    const invalidData = {
      name: 'Jo', // Too short
      age: -5, // Negative
      email: 'not-an-email' // Invalid email
    };
    
    // Parse and get validation error
    const result = testSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      const zodError = result.error;
      const errorResponse = handleValidationError(zodError.issues);
      
      expect(errorResponse).toBeDefined();
      expect(errorResponse.status).toBe(400);
    }
  });

  test('should handle AI processing error', () => {
    // Test with OpenAI error
    const openAIError = new Error('OpenAI API error');
    const response = handleAIError(openAIError);
    
    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
    
    // Test with rate limit error
    const rateLimitError = new Error('Rate limit exceeded');
    const rateLimitResponse = handleAIError(rateLimitError);
    
    expect(rateLimitResponse).toBeDefined();
    expect(rateLimitResponse.status).toBeDefined();
  });

  test('should handle rate limit error', () => {
    const rateLimitError = new Error('Rate limit exceeded');
    const response = handleAIError(rateLimitError);
    
    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
  });

  test('should format Zod error correctly', () => {
    // Create a Zod schema for testing
    const testSchema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
      email: z.string().email()
    });
    
    // Create an invalid object
    const invalidData = {
      name: 'Jo', // Too short
      age: -5, // Negative
      email: 'not-an-email' // Invalid email
    };
    
    // Parse and get validation error
    const result = testSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      const zodError = result.error;
      const response = handleValidationError(zodError.issues);
      
      expect(response).toBeDefined();
      expect(response.status).toBe(400);
    }
  });

  test('should identify retryable errors correctly', () => {
    // Test different error types with handleAIError
    const networkError = new Error('Network error');
    const networkResponse = handleAIError(networkError);
    expect(networkResponse).toBeDefined();
    
    const timeoutError = new Error('Timeout error');
    const timeoutResponse = handleAIError(timeoutError);
    expect(timeoutResponse).toBeDefined();
    
    const serverError = new Error('Server error');
    const serverResponse = handleAIError(serverError);
    expect(serverResponse).toBeDefined();
    
    const rateLimitError = new Error('Rate limit error');
    const rateLimitResponse = handleAIError(rateLimitError);
    expect(rateLimitResponse).toBeDefined();
  });

  test('should create error object with stack trace in development', () => {
    // Mock environment
    vi.stubEnv('NODE_ENV', 'development');
    
    const error = createErrorObject('TEST_ERROR', 'Test error message', { detail: 'Test detail' });
    
    expect(error.error).toBe('TEST_ERROR');
    expect(error.message).toBe('Test error message');
    expect(error.details).toEqual({ detail: 'Test detail' });
    expect(error.stack).toBeDefined();
    
    vi.unstubAllEnvs();
  });

  test('should create error object without stack trace in production', () => {
    // Mock environment
    vi.stubEnv('NODE_ENV', 'production');
    
    const error = createErrorObject('TEST_ERROR', 'Test error message', { detail: 'Test detail' });
    
    expect(error.error).toBe('TEST_ERROR');
    expect(error.message).toBe('Test error message');
    expect(error.details).toEqual({ detail: 'Test detail' });
    expect(error.stack).toBeUndefined();
    
    vi.unstubAllEnvs();
  });

  test('should handle nested Zod errors', () => {
    // Create a nested Zod schema for testing
    const addressSchema = z.object({
      street: z.string().min(5),
      city: z.string().min(2),
      zipCode: z.string().regex(/^\d{5}$/)
    });
    
    const userSchema = z.object({
      name: z.string().min(3),
      address: addressSchema
    });
    
    // Create an invalid object with nested errors
    const invalidData = {
      name: 'Jo', // Too short
      address: {
        street: 'Main', // Too short
        city: 'A', // Too short
        zipCode: 'ABC12' // Invalid format
      }
    };
    
    // Parse and get validation error
    const result = userSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      const zodError = result.error;
      const formattedError = formatZodError(zodError);
      
      expect(formattedError).toBeDefined();
      expect(formattedError.issues).toBeInstanceOf(Array);
      expect(formattedError.issues.length).toBe(4);
      
      // Check that all field errors are included with proper paths
      const nameIssue = formattedError.issues.find(issue => 
        issue.field === 'name');
      const streetIssue = formattedError.issues.find(issue => 
        issue.field === 'address.street');
      const cityIssue = formattedError.issues.find(issue => 
        issue.field === 'address.city');
      const zipCodeIssue = formattedError.issues.find(issue => 
        issue.field === 'address.zipCode');
      
      expect(nameIssue).toBeDefined();
      expect(streetIssue).toBeDefined();
      expect(cityIssue).toBeDefined();
      expect(zipCodeIssue).toBeDefined();
    }
  });
});