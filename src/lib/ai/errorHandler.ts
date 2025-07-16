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
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: AIErrorType
  message: string
  details?: any
  retryAfter?: number
}

/**
 * Handle AI errors and return appropriate responses
 */
export function handleAIError(error: unknown): NextResponse<ErrorResponse> {
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
          details: 'The AI model was unable to generate a valid document structure'
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
          retryAfter: 60 // Suggest retry after 60 seconds
        },
        { status: 429 }
      )
    }
    
    // Handle token limit errors
    if (error.message.toLowerCase().includes('token') && 
        error.message.toLowerCase().includes('limit')) {
      return NextResponse.json(
        {
          error: AIErrorType.AI_GENERATION_ERROR,
          message: 'Input too large for AI processing',
          details: 'The ticket data exceeds the token limit. Try reducing the content or excluding comments/attachments.'
        },
        { status: 413 }
      )
    }
  }

  // Generic server error
  return NextResponse.json(
    {
      error: AIErrorType.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred while analyzing the ticket',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    },
    { status: 500 }
  )
}

/**
 * Handle validation errors
 */
export function handleValidationError(issues: any[]): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: AIErrorType.VALIDATION_ERROR,
      message: 'Invalid request payload',
      details: issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    },
    { status: 400 }
  )
}