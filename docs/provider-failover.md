# Provider Failover System

This document describes the provider failover system implemented in the QA ChatCanvas API. The system ensures high availability and reliability by automatically switching between AI providers when one fails.

## Overview

The provider failover system implements the circuit breaker pattern to detect and handle failures in AI provider APIs. It provides automatic retry and failover between OpenAI and Anthropic, ensuring that the application remains operational even when one provider experiences issues.

## Key Components

### 1. Circuit Breaker Pattern

The circuit breaker pattern prevents cascading failures by detecting when a service is unavailable and temporarily stopping requests to that service. The implementation includes:

- **Failure Counting**: Tracks consecutive failures for each provider
- **Circuit Opening**: When failures exceed a threshold, the circuit "opens" and stops sending requests
- **Automatic Reset**: Circuits automatically reset after a configurable timeout period
- **Manual Reset**: Circuits can be manually reset through the API

### 2. Provider Management

The system manages multiple AI providers:

- **Primary Provider**: OpenAI (default)
- **Secondary Provider**: Anthropic (fallback)
- **Provider Health Tracking**: Monitors the health status of each provider
- **Provider Selection**: Selects available providers based on circuit status and priority

### 3. Retry Logic

The retry mechanism handles transient failures:

- **Exponential Backoff**: Increases delay between retries
- **Configurable Retries**: Maximum retry attempts can be configured
- **Cross-Provider Retries**: Attempts with all available providers before giving up

## Configuration

The failover system is configured through environment variables:

```
# Circuit Breaker Configuration
CIRCUIT_BREAKER_THRESHOLD=5      # Number of failures before opening circuit
CIRCUIT_BREAKER_RESET_TIMEOUT=60000  # Time in ms before auto-reset (1 minute)

# Retry Configuration
MAX_RETRIES=3                    # Maximum retry attempts
RETRY_DELAY_MS=1000              # Initial delay between retries in ms

# Provider Configuration
OPENAI_MODEL=gpt-4o              # OpenAI model to use
ANTHROPIC_MODEL=claude-3-opus-20240229  # Anthropic model to use
OPENAI_TIMEOUT=60000             # Timeout for OpenAI requests in ms
ANTHROPIC_TIMEOUT=60000          # Timeout for Anthropic requests in ms
```

## Implementation Details

### Provider Status Tracking

Each provider's status includes:

- **Available**: Whether the provider is configured and available
- **Failure Count**: Number of consecutive failures
- **Last Failure**: Timestamp of the last failure
- **Last Success**: Timestamp of the last successful request
- **Circuit Open**: Whether the circuit breaker is open
- **Circuit Open Time**: When the circuit was opened

### Failover Process

1. **Request Initiation**: Application makes a request to the AI provider
2. **Provider Selection**: System selects the highest priority available provider
3. **Request Execution**: System sends the request to the selected provider
4. **Success Handling**: On success, record success and return the result
5. **Failure Handling**:
   - Record failure for the provider
   - Increment failure count
   - If failure count exceeds threshold, open circuit
   - Try next available provider
   - If all providers fail, retry with exponential backoff
   - If all retries fail, return error

### API Functions

The system provides three main functions for AI interactions:

1. **generateObjectWithFailover**: For structured object generation
2. **generateTextWithFailover**: For text generation
3. **streamTextWithFailover**: For streaming text responses

Each function handles failover automatically and maintains the same interface as the Vercel AI SDK functions.

## Monitoring and Management

### Health Status API

The system provides a function to check the health status of all providers:

```typescript
getProviderHealthStatus(): Record<string, ProviderStatus>
```

This returns the current status of each provider, including circuit state and failure counts.

### Circuit Reset API

The system provides functions to reset circuit breakers:

```typescript
resetCircuitBreaker(providerName: string): boolean
resetAllCircuitBreakers(): void
```

These can be used to manually reset circuits after addressing provider issues.

## Error Handling

The system categorizes errors to determine if they are retryable:

- **Network Errors**: Retryable
- **Timeout Errors**: Retryable
- **Server Errors (5xx)**: Retryable
- **Rate Limit Errors (429)**: Retryable
- **Validation Errors (400)**: Non-retryable
- **Authentication Errors (401)**: Non-retryable
- **Not Found Errors (404)**: Non-retryable

## Testing Considerations

The system includes special handling for test environments:

- In test environments, the system bypasses the normal failover logic
- This allows tests to mock AI provider responses without triggering failover
- Test environment is detected by checking `process.env.NODE_ENV === 'test'`

## Best Practices

1. **Monitor Provider Health**: Regularly check provider health status
2. **Configure Appropriate Thresholds**: Adjust circuit breaker thresholds based on provider reliability
3. **Set Reasonable Timeouts**: Configure timeouts based on expected response times
4. **Handle Graceful Degradation**: Implement fallback behavior when all providers fail
5. **Log Failover Events**: Log when failover occurs for monitoring and debugging

## Example Usage

```typescript
import { generateObjectWithFailover } from '../lib/ai/providerFailover';
import { qaCanvasDocumentSchema } from '../lib/schemas/QACanvasDocument';

// Generate a QA document with automatic failover
const document = await generateObjectWithFailover(
  qaCanvasDocumentSchema,
  'Generate QA documentation for this ticket',
  {
    system: 'You are a QA analyst assistant',
    temperature: 0.7
  }
);
```

## Limitations and Future Improvements

1. **Provider-Specific Features**: Some provider-specific features may not be available when using failover
2. **Response Consistency**: Different providers may generate slightly different responses
3. **Cost Management**: No automatic cost optimization between providers
4. **Health Probing**: No proactive health checks (only reactive to failures)
5. **Persistent Circuit State**: Circuit state is lost on application restart

Future improvements could include:

1. **Persistent Circuit State**: Store circuit state in a database
2. **Proactive Health Checks**: Periodically check provider health
3. **Cost-Based Routing**: Route requests based on cost and quota usage
4. **Response Quality Monitoring**: Monitor and compare response quality between providers
5. **Regional Failover**: Support for region-specific provider endpoints