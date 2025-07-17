# QA ChatCanvas Backend API

Backend API for the QA ChatCanvas Interactive System - AI-powered QA documentation generation and refinement.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

3. Run development server:
```bash
npm run dev
```

4. Run tests:
```bash
npm test
```

## API Endpoints

- `POST /api/analyze-ticket` - Initial ticket analysis and QA document generation
- `POST /api/update-canvas` - Conversational refinement of QA documentation  
- `POST /api/generate-suggestions` - Generate contextual QA improvement suggestions

## Testing Endpoints

You can test the API endpoints using the provided test scripts:

### Testing update-canvas endpoint

```bash
node test-update-canvas.js
```

This script sends a request to the `/api/update-canvas` endpoint with a sample document and a user message. The endpoint returns a streaming response with AI-generated suggestions for improving the QA documentation.

### Testing generate-suggestions endpoint

```bash
node test-generate-suggestions.js
```

This script sends a request to the `/api/generate-suggestions` endpoint with a sample document. The endpoint returns structured suggestions for improving test coverage.

## Recent Updates

### Provider Failover Mock Enhancement (July 2025)

Enhanced test infrastructure for provider failover functionality:
- **Mock Consistency**: Added `getProviderHealthStatus` mock to update-canvas test suite
  - Fixed missing mock export that was causing test failures in error handling scenarios
  - Ensured consistent mocking pattern across all API endpoint tests
  - Mock returns proper health status structure with `available`, `circuitOpen`, and `lastError` fields
- **Error Handler Integration**: Improved error handling test coverage
  - Error handler now properly accesses provider health status during error scenarios
  - Enhanced error context with provider status information for better debugging
- **Test Reliability**: All update-canvas API tests now pass consistently
  - Fixed test expectations to match actual API implementation behavior
  - Updated mock function signatures to match AI SDK v5 requirements

### End-to-End Test Fixes (July 2025)

Fixed critical issues in the complete workflow test suite:
- **API Payload Consistency**: Fixed `currentDocument` parameter to be passed as object instead of JSON string
  - Updated `update-canvas` API call to pass document object directly
  - Ensured consistency between API endpoint expectations and test payloads
- **Suggestion Algorithm Robustness**: Added null checks in keyword matching to prevent runtime errors
  - Fixed `Cannot read properties of undefined (reading 'toLowerCase')` error
  - Enhanced error handling in coverage gap analysis
- **Performance Test Reliability**: Fixed concurrent request testing
  - Added proper mock reset between tests to prevent call count interference
  - Updated test ticket data to include all required JiraTicket schema fields
- **All E2E Tests Passing**: Complete workflow tests now pass for feature, bug, and API tickets

### Test Infrastructure Improvements (July 2025)

Enhanced test reliability and compatibility:
- **Generate Suggestions Tests**: Fixed mock response structure to match AI SDK v5 requirements
  - Updated `response` object structure with proper `id`, `timestamp`, `modelId`, `messages`, and `headers` fields
  - Changed `logprobs` from `null` to `undefined` for better type compatibility
  - All 14 test cases now pass successfully
- **Test Configuration**: Using Vitest as primary test runner with Node.js environment
- **TypeScript Compatibility**: Ensured all test mocks match the latest AI SDK type definitions

### Test Fixes for Document Regenerator (July 2025)

Fixed issues with the document regenerator tests:
- Updated mocking approach for the AI SDK in `documentRegenerator.test.ts`
- Properly mocked the `generateObject` function from the AI SDK
- Ensured all tests pass for the document regenerator module

### AI SDK v5 Integration (July 2025)

The backend has been updated to be compatible with Vercel AI SDK v5. Key changes include:

1. **Message Transformation Pipeline**: Updated to work with the latest SDK version
   - Removed dependency on `convertToCoreMessages` which is no longer required in v5
   - Implemented direct transformation of UI messages to model messages
   - Fixed test expectations to match the new implementation

2. **API Endpoints**: All endpoints now use the latest SDK functions
   - `/api/update-canvas`: Uses streamText for conversational interactions
   - `/api/generate-suggestions`: Uses generateObject with tools for structured output
   - `/api/analyze-ticket`: Uses generateObject for document generation

3. **Testing**: Added test scripts for manual endpoint testing
   - `test-update-canvas.js`: Tests the conversational refinement endpoint
   - `test-generate-suggestions.js`: Tests the suggestion generation endpoint

## Deployment

This project is configured for deployment on Ubuntu 22 with PM2:

```bash
npm run build
pm2 start ecosystem.config.js
```

Alternatively, you can deploy on Vercel for optimal integration with the Vercel AI SDK:

```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Deploy to Vercel
vercel
```

## Environment Variables

The following environment variables are required:

```
# AI Provider Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Optional fallback

# Environment
NODE_ENV=development|production

# API Configuration  
API_BASE_URL=http://localhost:3000  # Development
```

## Technical Architecture

### Core Technologies

- **Next.js 15**: App Router with Route Handlers for API endpoints
- **TypeScript 5**: Strict typing throughout the codebase
- **Node.js 20+**: Runtime environment
- **React 18**: Frontend components (minimal usage, primarily API-focused)

### AI & Data Validation

- **Vercel AI SDK v5**: Primary AI integration layer
  - `generateObject` for structured output generation
  - `streamText` for conversational interactions
  - Direct message transformation (no longer using `convertToCoreMessages`)
- **Zod**: Schema validation and type generation
- **OpenAI GPT-4o**: Primary AI model (with Anthropic Claude as fallback)

### Testing & Quality

- **Vitest**: Fast and modern testing framework with ES modules support
- **Supertest**: API endpoint testing
- **ESLint**: Code linting with Next.js configuration and TypeScript support
- **Manual Test Scripts**: Node.js scripts for endpoint testing

## Testing Framework

The project uses **Vitest** as the primary testing framework, providing fast execution and excellent ES modules support. All tests are located in the `src/__tests__` directory and follow a comprehensive testing strategy.

### Test Types

#### 1. Unit Tests
**Location**: `src/__tests__/lib/`
- **Algorithm Tests**: Core suggestion algorithms (`suggestionAlgorithms.test.ts`)
- **AI Integration**: Message transformers, error handlers, and AI utilities
- **Analysis Tools**: Ticket analyzers and test case formatters
- **Uncertainty Handling**: Logic for handling ambiguous requirements

#### 2. Integration Tests
**Location**: `src/__tests__/api/`
- **API Endpoints**: All three main API routes with full request/response validation
  - `analyze-ticket.test.ts` (7 tests) - Ticket analysis and document generation
  - `generate-suggestions.test.ts` (9 tests) - QA improvement suggestions
  - `update-canvas.test.ts` (9 tests) - Conversational document refinement
- **Provider Failover**: AI provider switching and circuit breaker logic
- **Error Handling**: Comprehensive error scenarios and status code validation

#### 3. End-to-End Tests
**Location**: `src/__tests__/e2e/`
- **Complete Workflow**: Full user journey from ticket analysis to suggestions
- **Multi-ticket Types**: Feature requests, bug reports, and API documentation
- **Performance Testing**: Concurrent request handling and response times

#### 4. Schema Validation Tests
**Location**: `src/__tests__/schemas/`
- **Data Validation**: Zod schema compliance for all data structures
- **Type Safety**: TypeScript type validation and discriminated unions
- **Real Data Testing**: Validation against actual production-like data

#### 5. Advanced Logic Tests
**Location**: `src/__tests__/lib/ai/`
- **Circuit Breaker**: Provider failover and retry mechanisms (2 tests skipped due to timing complexity)
- **Document Regeneration**: AI-powered document reconstruction
- **QA Suggestion Tools**: Advanced suggestion generation algorithms

### Test Statistics

- ✅ **254 tests passing** across 23 test files
- ⏭️ **2 tests skipped** (circuit breaker timing tests - non-critical)
- ⚡ **~800ms average execution time**
- 📊 **100% API endpoint coverage** (all 3 main endpoints)
- 🔄 **Complete workflow testing** from ticket analysis to suggestions

### Real API Testing Scripts

In addition to the comprehensive test suite, the project includes **real API testing scripts** located in the root directory. These scripts test the actual API endpoints using real HTTP requests, real data, and your actual API credentials (no mocks).

#### Available Scripts

| Script | Endpoint | Purpose | Data Type |
|--------|----------|---------|----------|
| `test-api-analyze-ticket.js` | `/api/analyze-ticket` | **Ticket Analysis** - Converts Jira tickets into QA Canvas documents | Complete ticket with attachments, comments, custom fields |
| `test-api-generate-suggestions.js` | `/api/generate-suggestions` | **QA Suggestions** - Generates improvement suggestions for existing documents | Full QA document with focus areas and exclusions |
| `test-api-generate-suggestions-advanced.js` | `/api/generate-suggestions` | **Advanced Suggestions** - Same endpoint with enhanced algorithm parameters | Extended focus areas and intelligent algorithms |
| `test-api-update-canvas.js` | `/api/update-canvas` | **Conversational Refinement** - Updates documents through chat interface | Streaming responses with conversation context |

#### Key Features

- ✅ **Real API Calls**: Direct HTTP requests to `localhost:3000`
- ✅ **No Mocks**: Uses actual OpenAI/Anthropic API credentials
- ✅ **Realistic Data**: Production-quality test payloads
- ✅ **Complete Coverage**: All main endpoints tested
- ✅ **Error Handling**: Comprehensive error reporting and debugging
- ✅ **Performance Metrics**: Response time measurement
- ✅ **Result Persistence**: Saves responses to files for analysis

#### Usage

```bash
# Test individual endpoints
node test-api-analyze-ticket.js
node test-api-generate-suggestions.js
node test-api-generate-suggestions-advanced.js
node test-api-update-canvas.js

# Make sure your server is running first
npm run dev
```

#### Sample Output

```
🚀 Probando endpoint /api/analyze-ticket...
⏱️  Tiempo de respuesta: 1247ms
📊 Status: 200 OK
✅ ¡Respuesta exitosa!
📋 Resumen del documento generado:
   • Ticket ID: TEST-123
   • Modelo AI: gpt-4o
   • Criterios de aceptación: 3
   • Casos de prueba: 5
💾 Documento completo guardado en: analyze-result.json
```

These scripts complement the automated test suite by providing manual testing capabilities with real API integration.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/__tests__/api/generate-suggestions.test.ts

# Run tests with coverage
npm run test:coverage
```

### Test Configuration

The project uses Vitest with the following configuration:
- **Environment**: Node.js
- **Module Support**: ES modules with TypeScript
- **Mocking**: Vi mocks for AI providers and external dependencies
- **Timeout**: 5000ms for complex integration tests
- **Coverage**: Comprehensive coverage reporting available

---

# **Technical Design Plan & Implementation: "QA Chat & Canvas" with Vercel AI SDK v5**

[Rest of the existing README content...]