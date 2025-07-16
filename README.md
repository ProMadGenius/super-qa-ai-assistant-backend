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

- **Vitest**: Fast and modern testing framework (primary test runner)
- **Jest**: Testing framework with Next.js integration (legacy support)
- **Supertest**: API endpoint testing
- **ESLint**: Code linting with Next.js configuration and TypeScript support
- **Manual Test Scripts**: Node.js scripts for endpoint testing

---

# **Technical Design Plan & Implementation: "QA Chat & Canvas" with Vercel AI SDK v5**

[Rest of the existing README content...]