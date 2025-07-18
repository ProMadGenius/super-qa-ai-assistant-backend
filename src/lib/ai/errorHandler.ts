/**
 * AI Error Handler
 * Provides consistent error handling for AI operations
 */

import { NextResponse } from 'next/server'
import { getProviderHealthStatus } from './providerFailover'

/**
 * CORS headers for API responses
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * Error types for AI operations
 */
export enum AIErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AI_PROCESSING_ERROR = 'AI_PROCESSING_ERROR',
  AI_GENERATION_ERROR = 'AI_GENERATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONTEXT_LIMIT_ERROR = 'CONTEXT_LIMIT_ERROR',
  CONTENT_FILTER_ERROR = 'CONTENT_FILTER_ERROR',
  CIRCUIT_OPEN_ERROR = 'CIRCUIT_OPEN_ERROR',
  FAILOVER_ERROR = 'FAILOVER_ERROR'
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
  providerStatus?: any
}

/**
 * Handle AI errors and return appropriate responses
 */
export function handleAIError(error: unknown, requestId?: string): NextResponse<ErrorResponse> {
  console.error('AI Error:', error)

  // Check for missing API key first
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: AIErrorType.CONFIGURATION_ERROR,
        message: 'API key configuration error',
        details: 'OpenAI API key is not configured',
        requestId,
        errorCode: 'MISSING_API_KEY',
        retryable: false,
        suggestions: [
          'Configure the OPENAI_API_KEY environment variable',
          'Contact your administrator to set up API credentials'
        ]
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  // Get current provider status for error context
  const providerStatus = getProviderHealthStatus();

  // Handle circuit breaker errors
  if (error instanceof Error && error.message.includes('No available AI providers. All circuits are open')) {
    return NextResponse.json(
      {
        error: AIErrorType.CIRCUIT_OPEN_ERROR,
        message: 'All AI providers are currently unavailable',
        details: 'The circuit breaker is open for all providers due to repeated failures',
        requestId,
        errorCode: 'CIRCUIT_OPEN',
        retryable: true,
        providerStatus,
        suggestions: [
          'Wait for the circuit breaker to reset automatically',
          'Contact your administrator to manually reset the circuit breaker',
          'Try again in a few minutes'
        ]
      },
      { status: 503, headers: CORS_HEADERS }
    )
  }

  // Handle failover errors
  if (error instanceof Error && error.message.includes('All providers failed after retries')) {
    return NextResponse.json(
      {
        error: AIErrorType.FAILOVER_ERROR,
        message: 'All AI provider failover attempts failed',
        details: 'The system attempted to use multiple providers but all attempts failed',
        requestId,
        errorCode: 'FAILOVER_FAILURE',
        retryable: true,
        providerStatus,
        suggestions: [
          'Try again with a simpler request',
          'Check if your API keys are configured correctly',
          'Wait a few minutes and try again'
        ]
      },
      { status: 502, headers: CORS_HEADERS }
    )
  }

  // Handle specific AI SDK errors
  if (error instanceof Error) {
    // Handle generation errors
    if (error.message.includes('AI_NoObjectGeneratedError') ||
      error.message.includes('failed to generate') ||
      error.message.includes('AI processing failed')) {
      return NextResponse.json(
        {
          error: AIErrorType.AI_PROCESSING_ERROR,
          message: 'AI processing failed',
          details: 'The AI model was unable to generate a valid document structure',
          requestId,
          errorCode: 'GEN_FAILURE',
          retryable: true,
          provider: extractProviderFromError(error),
          model: extractModelFromError(error),
          providerStatus,
          suggestions: [
            'Try simplifying the request',
            'Check if the input data is properly formatted',
            'Try again in a few moments'
          ]
        },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    // Handle rate limiting errors
    if (error.message.toLowerCase().includes('rate limit') ||
      error.message.toLowerCase().includes('quota')) {
      const provider = extractProviderFromError(error);

      // If we know which provider had the rate limit, record the failure
      if (provider) {
        // This will help the circuit breaker track failures
        try {
          const providerStatus = getProviderHealthStatus();
          if (providerStatus[provider]) {
            providerStatus[provider].failureCount++;
            providerStatus[provider].lastFailure = new Date();
          }
        } catch (e) {
          console.error('Failed to update provider status:', e);
        }
      }

      return NextResponse.json(
        {
          error: AIErrorType.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests',
          details: 'Please try again in a few moments',
          retryAfter: calculateRetryAfter(error),
          requestId,
          errorCode: 'RATE_LIMIT',
          retryable: true,
          provider,
          providerStatus: getProviderHealthStatus(),
          suggestions: [
            'Wait for the suggested retry period',
            'Try reducing the complexity of your request',
            'The system will automatically try an alternative provider if available',
            'Contact your administrator if this persists'
          ]
        },
        { status: 429, headers: CORS_HEADERS }
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
        { status: 413, headers: CORS_HEADERS }
      )
    }

    // Handle authentication errors
    if (error.message.toLowerCase().includes('auth') ||
      error.message.toLowerCase().includes('key') ||
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('permission')) {
      return NextResponse.json(
        {
          error: AIErrorType.CONFIGURATION_ERROR,
          message: 'API key configuration error',
          details: 'The system was unable to authenticate with the AI service',
          requestId,
          errorCode: 'CONFIG_ERROR',
          retryable: false,
          provider: extractProviderFromError(error),
          suggestions: [
            'Check if API keys are correctly configured',
            'Verify that your account has access to the requested model',
            'Contact your administrator to verify API credentials'
          ]
        },
        { status: 500, headers: CORS_HEADERS }
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
        { status: 504, headers: CORS_HEADERS }
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
        { status: 422, headers: CORS_HEADERS }
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
        { status: 502, headers: CORS_HEADERS }
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
    { status: 500, headers: CORS_HEADERS }
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
      message: 'Validation failed',
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
    { status: 400, headers: CORS_HEADERS }
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
  const modelMatches = errorMsg.match(/gpt-\d+(?:-\w+)?|claude-\d+(?:\.\d+)?|o4-(?:mini|preview|full)|gpt-4o(?:-mini)?/i);

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

/**
 * Create error object with optional stack trace
 */
export function createErrorObject(
  errorType: string,
  message: string,
  details?: any
): {
  error: string;
  message: string;
  details?: any;
  stack?: string;
} {
  const errorObj = {
    error: errorType,
    message,
    details
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    return {
      ...errorObj,
      stack: new Error().stack
    };
  }

  return errorObj;
}

/**
 * Format Zod error for better readability
 */
export function formatZodError(zodError: any): {
  message: string;
  issues: Array<{
    field: string;
    message: string;
    code: string;
    received?: any;
  }>;
} {
  const issues = zodError.issues.map((issue: any) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    received: issue.received
  }));

  return {
    message: `Validation failed with ${issues.length} error(s)`,
    issues
  };
}