# Implementation Plan

- [x] 1. Update the message transformer implementation
  - Remove the dependency on `convertToCoreMessages` and implement direct message transformation
  - _Requirements: 1.1, 2.1_

- [x] 1.1 Update imports in messageTransformer.ts
  - Remove the import of `convertToCoreMessages` from 'ai'
  - Keep necessary imports like `streamText` if used
  - _Requirements: 2.1_

- [x] 1.2 Refactor transformMessagesForAI function
  - Update the function to directly transform UI messages to the format expected by the AI SDK
  - Ensure backward compatibility by maintaining the same function signature
  - _Requirements: 1.2, 2.2, 4.1_

- [x] 1.3 Update buildEnhancedSystemMessage function
  - Ensure system messages are properly formatted according to the SDK requirements
  - _Requirements: 2.3_

- [x] 2. Update and fix tests for the message transformer
  - _Requirements: 1.1_

- [x] 2.1 Update messageTransformer.test.ts
  - Fix test expectations to match the new implementation
  - Add tests to verify the new implementation works correctly
  - _Requirements: 1.1_

- [x] 3. Fix API endpoint tests
  - _Requirements: 3.1, 3.2_

- [x] 3.1 Update update-canvas.test.ts
  - Fix test mocks and expectations to match the new implementation
  - _Requirements: 3.1_

- [x] 3.2 Update any other API endpoint tests that use the message transformer
  - Identify and fix other tests that might be affected by the changes
  - _Requirements: 3.1, 3.2_

- [x] 4. Verify all tests pass
  - Run the test suite to ensure all tests pass with the updated implementation
  - _Requirements: 1.1, 3.1_

- [x] 5. Update error handling if needed
  - Ensure errors during message transformation are properly handled and reported
  - _Requirements: 3.3_

- [x] 6. Document the changes
  - Add comments to explain the updated implementation
  - Update any documentation that references the message transformation pipeline
  - _Requirements: 4.1, 4.2_