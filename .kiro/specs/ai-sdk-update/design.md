# Design Document: AI SDK Update

## Overview

This design document outlines the approach to fix the failing tests in the QA ChatCanvas Backend application by updating the message transformation pipeline to be compatible with the current version of the Vercel AI SDK (v5). The main issue is that the `convertToCoreMessages` function is no longer required in the latest version of the SDK, as it now automatically converts incoming messages to the CoreMessage format.

## Architecture

The current architecture uses a message transformation pipeline that converts UI messages to model messages using the `convertToCoreMessages` function from the Vercel AI SDK. This function is used in the `transformMessagesForAI` function in the `messageTransformer.ts` file. The updated architecture will remove this dependency and implement a direct transformation approach that aligns with the latest SDK version.

## Components and Interfaces

### Message Transformer

The message transformer component is responsible for converting UI messages to model messages. The current implementation uses the `convertToCoreMessages` function, which is no longer required in the latest SDK version. The updated implementation will:

1. Remove the dependency on `convertToCoreMessages`
2. Implement a direct transformation approach that creates messages in the format expected by the AI SDK
3. Maintain the same function signatures to ensure backward compatibility

### API Endpoints

The API endpoints that use the message transformation pipeline will be updated to work with the new implementation. This includes:

1. `update-canvas` endpoint
2. Any other endpoints that use the message transformation pipeline

## Data Models

### UI Message

The UI message format will remain unchanged:

```typescript
export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: Date | string
  metadata?: Record<string, any>
}
```

### Model Message

The model message format will be updated to match the format expected by the AI SDK:

```typescript
export interface ModelMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  name?: string
  createdAt?: Date
}
```

## Implementation Details

### Message Transformer Updates

1. Remove the import of `convertToCoreMessages` from the 'ai' package
2. Update the `transformMessagesForAI` function to directly transform UI messages to the format expected by the AI SDK
3. Ensure that system messages are properly formatted
4. Maintain the same function signature to ensure backward compatibility

### Test Updates

1. Update the test mocks to reflect the new implementation
2. Ensure that all tests pass with the updated implementation
3. Add tests to verify that the new implementation works correctly with the AI SDK

## Error Handling

The error handling strategy will remain unchanged. The application will continue to use the existing error handling mechanisms to report and handle errors during message transformation and AI model communication.

## Testing Strategy

1. Unit tests for the updated message transformer functions
2. Integration tests for the API endpoints that use the message transformer
3. End-to-end tests to verify that the application works correctly with the updated implementation

## Migration Plan

1. Update the message transformer implementation
2. Update any affected tests
3. Verify that all tests pass
4. Deploy the updated implementation

## Risks and Mitigations

### Risk: Breaking changes in the AI SDK

**Mitigation:** Implement adapter functions to maintain backward compatibility with existing code.

### Risk: Unexpected behavior in the updated implementation

**Mitigation:** Comprehensive testing to ensure that the updated implementation works correctly.

### Risk: Performance impact

**Mitigation:** Monitor performance metrics to ensure that the updated implementation does not negatively impact performance.