# Provider Failover Implementation

This document describes the provider failover mechanism implemented in the QA ChatCanvas Backend API.

## Overview

The provider failover system provides resilience against AI provider failures by implementing:

1. **Circuit Breaker Pattern**: Automatically detects failing providers and temporarily disables them
2. **Retry Logic**: Implements exponential backoff for transient errors
3. **Provider Failover**: Switches between OpenAI and Anthropic when one provider fails
4. **Health Monitoring**: Tracks provider health status and failure rates

## Architecture

The failover system is implemented in `src/lib/ai/providerFailover.ts` and provides three main functions:

- `generateObjectWithFailover`: For structured object generation with schema validation
- `generateTextWithFailover`: For text generation with optional tool calls
- `streamTextWithFailover`: For streaming text responses

## Configuration

The failover system can be configured through environment variables:

```
# Provider Models
OPENAI_MODEL=gpt-4o                  # Default model for OpenAI
ANTHROPIC_MODEL=claude-3-opus-20240229  # Default model for Anthropic

# Circuit Breaker Configuration
CIRCUIT_BREAKER_THRESHOLD=5          # Number of failures before circuit opens
CIRCUIT_BREAKER_RESET_TIMEOUT=60000  # Time in ms before circuit resets (1 minute)

# Retry Configuration
MAX_RETRIES=3                        # Maximum retry attempts
RETRY_DELAY_MS=1000                  # Initial delay between retries in ms
```

## Circuit Breaker Pattern

The circuit breaker pattern prevents cascading failures by temporarily disabling providers that are experiencing issues:

1. **Closed State**: Normal operation, requests are sent to the provider
2. **Open State**: After `CIRCUIT_BREAKER_THRESHOLD` failures, the provider is temporarily disabled
3. **Half-Open State**: After `CIRCUIT_BREAKER_RESET_TIMEOUT` milliseconds, the circuit attempts to reset

## Provider Priority

Providers are assigned a weight that determines their priority:

- OpenAI: Weight 10 (primary provider)
- Anthropic: Weight 5 (secondary provider)

The system will always try providers in order of their weight (highest first).

## Error Handling

The failover system handles various error types:

- **Rate Limiting**: Detected and tracked for circuit breaker decisions
- **Authentication Errors**: Tracked but not retried (requires configuration fix)
- **Timeout Errors**: Retried with exponential backoff
- **Provider-Specific Errors**: Tracked and used for failover decisions

## Monitoring

Provider health status can be monitored using the `getProviderHealthStatus()` function, which returns:

```typescript
{
  openai: {
    name: 'openai',
    available: boolean,
    failureCount: number,
    lastFailure: Date | null,
    lastSuccess: Date | null,
    circuitOpen: boolean,
    circuitOpenTime: Date | null
  },
  anthropic: {
    // Same structure as above
  }
}
```

## Manual Control

The system provides functions for manual control:

- `resetCircuitBreaker(providerName)`: Reset the circuit breaker for a specific provider
- `resetAllCircuitBreakers()`: Reset all circuit breakers

## Integration with Error Handler

The provider failover system integrates with the error handling system in `src/lib/ai/errorHandler.ts` to provide detailed error responses with provider status information.

## Usage Example

```typescript
import { generateObjectWithFailover } from '@/lib/ai/providerFailover';

// Define the expected return type for your schema
interface MyGeneratedResult {
  object: any;
  [key: string]: any;
}

// Generate a structured object with failover
try {
  const result = await generateObjectWithFailover<MyGeneratedResult>(
    mySchema,
    prompt,
    {
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 4000
    }
  );
  
  // Use the generated object
  const generatedDocument = result.object;
} catch (error) {
  // Handle errors after all providers and retries have failed
  console.error('All providers failed:', error);
}
```