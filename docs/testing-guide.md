# Testing Guide - QA ChatCanvas Backend

## Overview

This project uses **Vitest** as the primary testing framework, providing fast execution, excellent ES modules support, and seamless TypeScript integration. The testing strategy covers all aspects of the application from unit tests to end-to-end workflows.

### Key Benefits of Vitest

- **Fast Execution**: ~800ms average test suite execution time
- **ES Modules Support**: Native support for modern JavaScript modules
- **TypeScript Integration**: Built-in TypeScript support without additional configuration
- **Vite Integration**: Leverages Vite's fast build system

## Test Structure

### Directory Organization

```
src/__tests__/
├── api/                    # Integration tests for API endpoints
│   ├── analyze-ticket.test.ts
│   ├── generate-suggestions.test.ts
│   └── update-canvas.test.ts
├── e2e/                    # End-to-end workflow tests
│   └── complete-workflow.test.ts
├── lib/                    # Unit tests for core logic
│   ├── ai/                 # AI-related functionality
│   │   ├── errorHandler.test.ts
│   │   ├── messageTransformer.test.ts
│   │   ├── providerFailover.test.ts
│   │   ├── suggestionAlgorithms.test.ts
│   │   └── uncertaintyHandler.test.ts
│   └── analysis/           # Analysis tools
│       ├── testCaseFormatter.test.ts
│       └── ticketAnalyzer.test.ts
├── schemas/                # Schema validation tests
│   ├── JiraTicket.test.ts
│   ├── QACanvasDocument.test.ts
│   └── QASuggestion.test.ts
└── setup.test.ts          # Test environment setup
```

## Test Categories

### 1. Unit Tests (Core Logic)

**Purpose**: Test individual functions and modules in isolation

**Examples**:
- `suggestionAlgorithms.test.ts` - Core suggestion generation logic
- `messageTransformer.test.ts` - Message transformation utilities
- `errorHandler.test.ts` - Error handling and classification
- `uncertaintyHandler.test.ts` - Ambiguity detection and handling

**Characteristics**:
- Fast execution (< 100ms per test)
- Isolated dependencies with mocks
- High code coverage
- Focus on business logic

### 2. Integration Tests (API Endpoints)

**Purpose**: Test complete API request/response cycles with all dependencies

**Coverage**:
- **analyze-ticket** (7 tests): Ticket analysis and document generation
- **generate-suggestions** (9 tests): QA improvement suggestions with AI integration
- **update-canvas** (9 tests): Conversational document refinement

**Test Scenarios**:
- Valid request processing
- Input validation and error handling
- AI provider integration
- Status code validation
- Response structure verification

### 3. End-to-End Tests

**Purpose**: Test complete user workflows from start to finish

**Scenarios**:
- Feature ticket → Analysis → Suggestions → Refinement
- Bug report → Analysis → Test case generation
- API documentation → Analysis → Coverage suggestions
- Performance testing with concurrent requests

### 4. Schema Validation Tests

**Purpose**: Ensure data integrity and type safety

**Coverage**:
- Zod schema compliance
- TypeScript type validation
- Discriminated union handling
- Real-world data validation
- Edge case data structures

### 5. Advanced Logic Tests

**Purpose**: Test complex algorithms and AI integrations

**Examples**:
- Circuit breaker logic (provider failover)
- Document regeneration algorithms
- QA suggestion tools
- Provider health monitoring

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.test.ts'],
    timeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
```

### Mock Strategy

The project uses comprehensive mocking for:
- **AI Providers**: OpenAI and Anthropic API calls
- **External Dependencies**: HTTP requests and third-party services
- **Environment Variables**: API keys and configuration
- **File System**: Document storage and retrieval

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/__tests__/api/generate-suggestions.test.ts

# Run tests with specific pattern
npm test -- --grep "should handle error"

# Run tests with coverage
npm run test:coverage
```

### Test Filtering

```bash
# Run only API tests
npm test -- src/__tests__/api/

# Run only unit tests
npm test -- src/__tests__/lib/

# Run specific test suite
npm test -- -t "Provider Failover Logic"
```

## Test Statistics

### Current Status
- ✅ **254 tests passing**
- ⏭️ **2 tests skipped** (circuit breaker timing tests)
- 📁 **23 test files**
- ⚡ **~800ms average execution time**

### Coverage Areas
- **API Endpoints**: 100% coverage (all 3 endpoints)
- **Core Algorithms**: 100% coverage (12/12 tests)
- **Schema Validation**: 100% coverage (all schemas)
- **Error Handling**: Comprehensive error scenarios
- **AI Integration**: Full provider failover testing

## Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, behavior-focused descriptions
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Mock External Dependencies**: Isolate units under test
4. **Test Error Scenarios**: Include failure cases
5. **Use Type-Safe Mocks**: Leverage TypeScript for mock validation

### Mock Guidelines

```typescript
// Good: Type-safe mock with proper structure
vi.mock('@/lib/ai/providerFailover', () => ({
  generateTextWithFailover: vi.fn().mockResolvedValue({
    text: 'Generated text',
    usage: { totalTokens: 100 }
  })
}))

// Good: Comprehensive error mock
vi.mock('@/lib/ai/errorHandler', () => ({
  handleAIError: vi.fn().mockImplementation((error) => ({
    type: 'AI_PROCESSING_ERROR',
    message: error.message,
    retryable: true
  }))
}))
```

### Performance Considerations

- Keep unit tests under 100ms
- Use `vi.clearAllMocks()` between tests
- Avoid real network calls in tests
- Use `beforeEach` for common setup
- Clean up resources in `afterEach`

## Debugging Tests

### Common Issues

1. **Mock Not Working**: Ensure mock is defined before import
2. **Timeout Errors**: Increase timeout for complex integration tests
3. **Type Errors**: Verify mock types match actual implementation
4. **Async Issues**: Use proper async/await patterns

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run single test with debugging
npm test -- --reporter=verbose -t "specific test name"

# Run tests with console output
npm test -- --reporter=verbose --no-coverage
```

## Continuous Integration

The test suite is designed to run efficiently in CI environments:
- Fast execution (< 1 second total)
- No external dependencies
- Comprehensive error reporting
- Coverage reporting integration
- Parallel test execution support

## Real API Testing Scripts

Beyond the comprehensive automated test suite, the project includes **real API testing scripts** in the root directory. These scripts provide manual testing capabilities against the actual running API server.

### Purpose and Benefits

- **Real Integration Testing**: Tests actual API endpoints without mocks
- **Production Validation**: Uses real AI provider credentials and responses
- **Manual Testing**: Allows for ad-hoc testing and debugging
- **Performance Monitoring**: Measures actual response times
- **Result Analysis**: Saves complete responses for inspection

### Available Scripts

#### `test-api-analyze-ticket.js`
**Endpoint**: `/api/analyze-ticket`
**Purpose**: Ticket Analysis and QA Document Generation

```bash
node test-api-analyze-ticket.js
```

**Features**:
- Complete Jira ticket payload with attachments and comments
- Real AI processing for document generation
- Detailed output with metadata and statistics
- Saves complete result to `analyze-result.json`
- Comprehensive error handling and debugging info

#### `test-api-generate-suggestions.js`
**Endpoint**: `/api/generate-suggestions`
**Purpose**: QA Improvement Suggestions Generation

```bash
node test-api-generate-suggestions.js
```

**Features**:
- Full QA Canvas document as input
- Focus areas: `['edge_case', 'ui_verification']`
- Excludes: `['performance_test']`
- Real AI-powered suggestion generation
- Validates suggestion algorithms and AI integration

#### `test-api-generate-suggestions-advanced.js`
**Endpoint**: `/api/generate-suggestions` (Advanced)
**Purpose**: Enhanced Suggestion Generation with Extended Parameters

```bash
node test-api-generate-suggestions-advanced.js
```

**Features**:
- Extended focus areas: `['edge_case', 'clarification_question', 'functional_test']`
- Higher suggestion count (5 suggestions)
- Tests advanced algorithm capabilities
- Validates intelligent suggestion prioritization

#### `test-api-update-canvas.js`
**Endpoint**: `/api/update-canvas`
**Purpose**: Conversational Document Refinement

```bash
node test-api-update-canvas.js
```

**Features**:
- Conversational message input
- Streaming response handling
- Real-time document updates
- Tests chat-based refinement workflow
- Handles both streaming and standard responses

### Usage Guidelines

#### Prerequisites
```bash
# Ensure server is running
npm run dev

# Verify environment variables are set
# OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
```

#### Running Scripts
```bash
# Test all endpoints sequentially
node test-api-analyze-ticket.js
node test-api-generate-suggestions.js
node test-api-generate-suggestions-advanced.js
node test-api-update-canvas.js

# Or run individually as needed
node test-api-analyze-ticket.js
```

#### Expected Output Format
```
🚀 Probando endpoint /api/analyze-ticket...
⏱️  Tiempo de respuesta: 1247ms
📊 Status: 200 OK
✅ ¡Respuesta exitosa!
📋 Resumen del documento generado:
   • Ticket ID: TEST-123
   • Modelo AI: gpt-4o
   • Tiempo de generación: 1247ms
   • Conteo de palabras: 1543
   • Criterios de aceptación: 3
   • Casos de prueba: 5
   • Advertencias: 1
💾 Documento completo guardado en: analyze-result.json
```

### Troubleshooting

#### Common Issues
1. **Connection Refused**: Server not running - execute `npm run dev`
2. **API Key Errors**: Missing environment variables
3. **Timeout Errors**: AI provider issues or network problems
4. **Validation Errors**: Payload structure mismatches

#### Debug Mode
```bash
# Add debugging output
DEBUG=* node test-api-analyze-ticket.js
```

### Integration with Automated Tests

These scripts complement the automated test suite:
- **Automated Tests**: Fast, reliable, comprehensive coverage with mocks
- **Real API Scripts**: Manual validation, real integration, performance testing
- **Combined Approach**: Ensures both code correctness and real-world functionality

## Future Enhancements

- **Visual Regression Testing**: Screenshot comparison for UI components
- **Load Testing**: Performance testing for high-traffic scenarios
- **Contract Testing**: API contract validation
- **Mutation Testing**: Code quality assessment
- **E2E Browser Testing**: Full browser automation tests
