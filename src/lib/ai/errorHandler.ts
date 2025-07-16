/**
 * AI Error Handler
 * Provides consistent error handling for AI operations
 */

import { NextResponse } from 'next/server'

/**
 * Error types for AI operations
 */
export enum AIErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AI_GENERATION_ERROR = 'AI_GENERATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONTEXT_LIMIT_ERROR = 'CONTEXT_LIMIT_ERROR',
  CONTENT_FILTER_ERROR = 'CONTENT_FILTER_ERROR'
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: AIErrorType
  message: string
  details?: any
  retryAfter?: number
  requestId?: string
  errorCode?: string
  retryable?: boolean
  provider?: string
  model?: string
  suggestions?: string[]
}

/**
 * Handle AI errors and return appropriate responses
 */
export function handleAIError(error: unknown, requestId?: string): NextResponse<ErrorResponse> {
  console.error('AI Error:', error)
  
  // Handle specific AI SDK errors
  if (error instanceof Error) {
    // Handle generation errors
    if (error.message.includes('AI_NoObjectGeneratedError') || 
        error.message.includes('failed to generate')) {
      return NextResponse.json(
        {
          error: AIErrorType.AI_GENERATION_ERROR,
          message: 'Failed to generate structured QA documentation',
          details: 'The AI model was unable to generate a valid document structure',
          requestId,
          errorCode: 'GEN_FAILURE',
          retryable: true,
          provider: extractProviderFromError(error),
          model: extractModelFromError(error),
          suggestions: [
            'Try simplifying the request',
            'Check if the input data is properly formatted',
            'Try again in a few moments'
          ]
        },
        { status: 500 }
      )
    }

    // Handle rate limiting errors
    if (error.message.toLowerCase().includes('rate limit') || 
        error.message.toLowerCase().includes('quota')) {
      return NextResponse.json(
        {
          error: AIErrorType.RATE_LIMIT_ERROR,
          message: 'AI service rate limit exceeded',
          details: 'Please try again in a few moments',
          retryAfter: calculateRetryAfter(error),
          requestId,
          errorCode: 'RATE_LIMIT',
          retryable: true,
          provider: extractProviderFromError(error),
          suggestions: [
            'Wait for the suggested retry period',
            'Try reducing the complexity of your request',
            'Contact your administrator if this persists'
          ]
        },
        { status: 429 }
      )
    }
    
    // Handle token limit errors
    if (error.message.toLowerCase().includes('token') && 
        error.message.toLowerCase().includes('limit')) {
      return NextResponse.json(
        {
          error: AIErrorType.CONTEXT_LIMIT_ERROR,
          message: 'Input too large for AI processing',
          details: 'The ticket data exceeds the token limit.',
          requestId,
          errorCode: 'TOKEN_LIMIT',
          retryable: true,
          provider: extractProviderFromError(error),
          suggestions: [
            'Try reducing the content or excluding comments/attachments',
            'Split the request into smaller chunks',
            'Remove non-essential information from the ticket'
          ]
        },
        { status: 413 }
      )
    }

    // Handle authentication errors
    if (error.message.toLowerCase().includes('auth') || 
        error.message.toLowerCase().includes('key') ||
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('permission')) {
      return NextResponse.json(
        {
          error: AIErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication failed with AI provider',
          details: 'The system was unable to authenticate with the AI service',
          requestId,
          errorCode: 'AUTH_ERROR',
          retryable: false,
          provider: extractProviderFromError(error),
          suggestions: [
            'Check if API keys are correctly configured',
            'Verify that your account has access to the requested model',
            'Contact your administrator to verify API credentials'
          ]
        },
        { status: 401 }
      )
    }

    // Handle timeout errors
    if (error.message.toLowerCase().includes('timeout') || 
        error.message.toLowerCase().includes('timed out')) {
      return NextResponse.json(
        {
          error: AIErrorType.TIMEOUT_ERROR,
          message: 'AI request timed out',
          details: 'The request took too long to process and was terminated',
          requestId,
          errorCode: 'TIMEOUT',
          retryable: true,
          provider: extractProviderFromError(error),
          suggestions: [
            'Try again with a simpler request',
            'Break down your request into smaller parts',
            'Try again during a less busy time'
          ]
        },
        { status: 504 }
      )
    }

    // Handle content filter errors
    if (error.message.toLowerCase().includes('content') && 
        (error.message.toLowerCase().includes('filter') || 
         error.message.toLowerCase().includes('policy') ||
         error.message.toLowerCase().includes('moderation'))) {
      return NextResponse.json(
        {
          error: AIErrorType.CONTENT_FILTER_ERROR,
          message: 'Content filtered by AI provider',
          details: 'The request was rejected due to content policy violations',
          requestId,
          errorCode: 'CONTENT_FILTER',
          retryable: false,
          provider: extractProviderFromError(error),
          suggestions: [
            'Review your input for potentially problematic content',
            'Modify your request to comply with content policies',
            'Contact support if you believe this is an error'
          ]
        },
        { status: 422 }
      )
    }

    // Handle provider-specific errors
    if (error.message.toLowerCase().includes('openai') || 
        error.message.toLowerCase().includes('anthropic') ||
        error.message.toLowerCase().includes('provider')) {
      return NextResponse.json(
        {
          error: AIErrorType.PROVIDER_ERROR,
          message: 'AI provider service error',
          details: 'The AI service provider encountered an error processing your request',
          requestId,
          errorCode: 'PROVIDER_ERROR',
          retryable: true,
          provider: extractProviderFromError(error),
          suggestions: [
            'Try again in a few moments',
            'Check the AI provider status page for service issues',
            'Try switching to an alternative AI provider if available'
          ]
        },
        { status: 502 }
      )
    }
  }

  // Generic server error
  return NextResponse.json(
    {
      error: AIErrorType.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      requestId,
      errorCode: 'INTERNAL_ERROR',
      retryable: true,
      suggestions: [
        'Try your request again',
        'If the problem persists, contact support with the request ID'
      ]
    },
    { status: 500 }
  )
}

/**
 * Handle validation errors with detailed field information
 */
export function handleValidationError(issues: any[], requestId?: string): NextResponse<ErrorResponse> {
  // Group issues by field for better organization
  const groupedIssues = issues.reduce((acc, issue) => {
    const field = issue.path.join('.');
    if (!acc[field]) {
      acc[field] = [];
    }
    acc[field].push({
      message: issue.message,
      code: issue.code,
      received: issue.received
    });
    return acc;
  }, {});

  return NextResponse.json(
    {
      error: AIErrorType.VALIDATION_ERROR,
      message: 'Invalid request payload',
      details: {
        issues: issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
          received: issue.received
        })),
        groupedByField: groupedIssues
      },
      requestId,
      errorCode: 'VALIDATION_ERROR',
      retryable: true,
      suggestions: generateValidationSuggestions(issues)
    },
    { status: 400 }
  )
}

/**
 * Generate helpful suggestions based on validation errors
 */
function generateValidationSuggestions(issues: any[]): string[] {
  const suggestions: string[] = [];
  
  // Check for common validation issues and provide specific suggestions
  const hasMissingFields = issues.some(issue => issue.code === 'invalid_type' && issue.received === 'undefined');
  const hasInvalidEnums = issues.some(issue => issue.code === 'invalid_enum_value');
  const hasInvalidFormats = issues.some(issue => issue.code === 'invalid_string');
  
  if (hasMissingFields) {
    suggestions.push('Check for missing required fields in your request');
  }
  
  if (hasInvalidEnums) {
    suggestions.push('Verify that enum values match the expected options');
  }
  
  if (hasInvalidFormats) {
    suggestions.push('Ensure string formats (dates, emails, etc.) are correctly formatted');
  }
  
  // Add general suggestions
  suggestions.push('Review the API documentation for correct payload structure');
  suggestions.push('Validate your JSON structure before sending');
  
  return suggestions;
}

/**
 * Extract provider information from error message
 */
function extractProviderFromError(error: Error): string | undefined {
  const errorMsg = error.message.toLowerCase();
  
  if (errorMsg.includes('openai')) {
    return 'openai';
  } else if (errorMsg.includes('anthropic')) {
    return 'anthropic';
  } else if (errorMsg.includes('ai-sdk')) {
    return 'ai-sdk';
  }
  
  return undefined;
}

/**
 * Extract model information from error message
 */
function extractModelFromError(error: Error): string | undefined {
  const errorMsg = error.message;
  
  // Try to extract model names like gpt-4, gpt-3.5-turbo, claude-2, etc.
  const modelMatches = errorMsg.match(/gpt-\d+(?:-\w+)?|claude-\d+(?:\.\d+)?|gpt-4o/i);
  
  if (modelMatches && modelMatches[0]) {
    return modelMatches[0].toLowerCase();
  }
  
  return undefined;
}

/**
 * Calculate retry-after time based on error message
 */
function calculateRetryAfter(error: Error): number {
  const errorMsg = error.message.toLowerCase();
  
  // Try to extract retry time from error message
  const retryMatches = errorMsg.match(/retry after (\d+)/i);
  if (retryMatches && retryMatches[1]) {
    return parseInt(retryMatches[1], 10);
  }
  
  // Default retry times based on error type
  if (errorMsg.includes('rate limit')) {
    return 60; // 1 minute for rate limits
  } else if (errorMsg.includes('quota')) {
    return 3600; // 1 hour for quota issues
  }
  
  return 30; // Default 30 seconds
}