# QA ChatCanvas Backend API

**AI-powered QA documentation generation and refinement system with intelligent failover and comprehensive testing**

---

## 📋 Table of Contents

1. [🚀 Quick Start](#-quick-start)
2. [🏗️ System Architecture](#️-system-architecture)
3. [🔧 Configuration](#-configuration)
4. [📡 API Endpoints](#-api-endpoints)
5. [🧪 Testing Framework](#-testing-framework)
6. [🔄 Provider Failover System](#-provider-failover-system)
7. [🚀 Deployment Guide](#-deployment-guide)
8. [📊 Performance & Monitoring](#-performance--monitoring)
9. [🔒 Security Considerations](#-security-considerations)
10. [🛠️ Development Guide](#️-development-guide)
11. [📚 Additional Resources](#-additional-resources)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- npm or yarn package manager
- OpenAI API key (required)
- Anthropic API key (optional, for failover)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd super-qa-ai-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Setup

```bash
# Required environment variables
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Optional fallback
NODE_ENV=development
API_BASE_URL=http://localhost:3000

# Optional configuration
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=60000
MAX_RETRIES=3
RETRY_DELAY_MS=1000
```

### Running the Application

```bash
# Development server
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## 🏗️ System Architecture

### Core Technologies

- **Next.js 15**: App Router with Route Handlers for API endpoints
- **TypeScript 5**: Strict typing throughout the codebase
- **Vercel AI SDK v5**: AI provider integration with streaming support
- **Zod**: Runtime type validation and schema enforcement
- **Vitest**: Fast testing framework with ES modules support

### Project Structure

```
src/
├── app/
│   └── api/                    # API route handlers
│       ├── analyze-ticket/     # Ticket analysis endpoint
│       ├── generate-suggestions/ # QA suggestions endpoint
│       └── update-canvas/      # Conversational refinement
├── lib/
│   ├── ai/                     # AI integration layer
│   │   ├── providerFailover.ts # Circuit breaker & failover
│   │   ├── messageTransformer.ts # Message processing
│   │   └── errorHandler.ts     # Error classification
│   ├── analysis/               # Analysis algorithms
│   │   ├── suggestionAlgorithms.ts # Core suggestion logic
│   │   ├── uncertaintyHandler.ts   # Ambiguity detection
│   │   └── ticketAnalyzer.ts      # Ticket processing
│   └── schemas/                # Zod validation schemas
│       ├── JiraTicket.ts       # Jira ticket structure
│       ├── QACanvasDocument.ts # QA document schema
│       └── QASuggestion.ts     # Suggestion schema
└── __tests__/                  # Comprehensive test suite
    ├── api/                    # Integration tests
    ├── lib/                    # Unit tests
    ├── e2e/                    # End-to-end tests
    └── schemas/                # Schema validation tests
```

### Key Features

- **🤖 AI-Powered Analysis**: Converts Jira tickets into comprehensive QA documentation
- **💬 Conversational Refinement**: Chat-based document improvement
- **🎯 Intelligent Suggestions**: Context-aware QA improvement recommendations
- **🔄 Provider Failover**: Automatic switching between OpenAI and Anthropic
- **⚡ High Performance**: Circuit breaker pattern for reliability
- **🧪 Comprehensive Testing**: 254 tests with 100% API coverage
- **📊 Real-time Streaming**: Streaming responses for better UX
- **🔒 Type Safety**: Full TypeScript coverage with runtime validation

---

## 🔧 Configuration

### Environment Variables

#### Required Variables
```bash
# AI Provider Configuration
OPENAI_API_KEY=sk-...                    # OpenAI API key (required)
ANTHROPIC_API_KEY=sk-ant-...            # Anthropic API key (optional)

# Application Configuration
NODE_ENV=development|production          # Environment mode
API_BASE_URL=http://localhost:3000      # Base URL for API
```

#### Optional Configuration
```bash
# Circuit Breaker Settings
CIRCUIT_BREAKER_THRESHOLD=5             # Failures before circuit opens
CIRCUIT_BREAKER_RESET_TIMEOUT=60000     # Auto-reset timeout (ms)

# Retry Configuration
MAX_RETRIES=3                           # Maximum retry attempts
RETRY_DELAY_MS=1000                     # Initial retry delay (ms)

# Model Configuration
OPENAI_MODEL=gpt-4o                     # OpenAI model to use
ANTHROPIC_MODEL=claude-3-opus-20240229  # Anthropic model to use

# Timeout Settings
OPENAI_TIMEOUT=60000                    # OpenAI request timeout (ms)
ANTHROPIC_TIMEOUT=60000                 # Anthropic request timeout (ms)
```

### Configuration Files

#### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

#### Vitest Configuration
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

---

## 📡 API Endpoints

### Core Endpoints

#### 1. Analyze Ticket
**Endpoint**: `POST /api/analyze-ticket`
**Purpose**: Convert Jira tickets into comprehensive QA Canvas documents

**Request Body**:
```typescript
{
  ticket: JiraTicket,           // Complete Jira ticket data
  options?: {
    includeAttachments?: boolean,
    generateTestCases?: boolean,
    analysisDepth?: 'basic' | 'detailed'
  }
}
```

**Response**:
```typescript
{
  success: boolean,
  document: QACanvasDocument,   // Generated QA document
  metadata: {
    processingTime: number,
    aiModel: string,
    wordCount: number,
    testCaseCount: number
  }
}
```

#### 2. Generate Suggestions
**Endpoint**: `POST /api/generate-suggestions`
**Purpose**: Generate contextual QA improvement suggestions

**Request Body**:
```typescript
{
  currentDocument: QACanvasDocument,
  focusAreas?: SuggestionType[],    // Areas to focus on
  excludeTypes?: SuggestionType[],  // Types to exclude
  maxSuggestions?: number,          // Maximum suggestions (default: 5)
  context?: string                  // Additional context
}
```

**Response**:
```typescript
{
  success: boolean,
  suggestions: QASuggestion[],      // Generated suggestions
  metadata: {
    totalSuggestions: number,
    processingTime: number,
    aiModel: string
  }
}
```

#### 3. Update Canvas
**Endpoint**: `POST /api/update-canvas`
**Purpose**: Conversational refinement of QA documentation

**Request Body**:
```typescript
{
  currentDocument: QACanvasDocument,
  message: string,                  // User's refinement request
  conversationHistory?: Message[]   // Previous conversation
}
```

**Response**: Streaming response with real-time updates
```typescript
// Streamed chunks
{
  type: 'delta' | 'done',
  content?: string,
  updatedDocument?: QACanvasDocument
}
```

### Error Responses

All endpoints return consistent error responses:

```typescript
{
  success: false,
  error: {
    code: string,                   // Error code (e.g., 'VALIDATION_ERROR')
    message: string,                // Human-readable message
    details?: any,                  // Additional error details
    timestamp: string               // ISO timestamp
  }
}
```

### Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid API keys)
- `429` - Rate Limited
- `500` - Internal Server Error (AI processing errors)
- `503` - Service Unavailable (all AI providers down)

---

## 🧪 Testing Framework

The project uses **Vitest** as the primary testing framework, providing comprehensive coverage across all system components.

### Test Statistics

- ✅ **254 tests passing** across 23 test files
- ⏭️ **2 tests skipped** (circuit breaker timing tests - non-critical)
- ⚡ **~800ms average execution time**
- 📊 **100% API endpoint coverage** (all 3 main endpoints)
- 🔄 **Complete workflow testing** from ticket analysis to suggestions

### Test Categories

#### 1. Unit Tests (`src/__tests__/lib/`)
**Purpose**: Test individual functions and modules in isolation

**Coverage**:
- **Algorithm Tests**: Core suggestion algorithms (`suggestionAlgorithms.test.ts`)
- **AI Integration**: Message transformers, error handlers, and AI utilities
- **Analysis Tools**: Ticket analyzers and test case formatters
- **Uncertainty Handling**: Logic for handling ambiguous requirements

**Characteristics**:
- Fast execution (< 100ms per test)
- Isolated dependencies with mocks
- High code coverage
- Focus on business logic

#### 2. Integration Tests (`src/__tests__/api/`)
**Purpose**: Test complete API request/response cycles

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

#### 3. End-to-End Tests (`src/__tests__/e2e/`)
**Purpose**: Test complete user workflows

**Scenarios**:
- Feature ticket → Analysis → Suggestions → Refinement
- Bug report → Analysis → Test case generation
- API documentation → Analysis → Coverage suggestions
- Performance testing with concurrent requests

#### 4. Schema Validation Tests (`src/__tests__/schemas/`)
**Purpose**: Ensure data integrity and type safety

**Coverage**:
- Zod schema compliance
- TypeScript type validation
- Discriminated union handling
- Real-world data validation
- Edge case data structures

#### 5. Advanced Logic Tests (`src/__tests__/lib/ai/`)
**Purpose**: Test complex algorithms and AI integrations

**Examples**:
- Circuit breaker logic (provider failover)
- Document regeneration algorithms
- QA suggestion tools
- Provider health monitoring

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/__tests__/api/generate-suggestions.test.ts

# Run tests with pattern matching
npm test -- --grep "should handle error"

# Run tests with coverage
npm run test:coverage

# Run tests for specific category
npm test -- src/__tests__/api/        # Integration tests only
npm test -- src/__tests__/lib/        # Unit tests only
npm test -- src/__tests__/e2e/        # E2E tests only
```

### Real API Testing Scripts

In addition to the automated test suite, the project includes **real API testing scripts** that test actual endpoints without mocks.

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
# Ensure server is running
npm run dev

# Test individual endpoints
node test-api-analyze-ticket.js
node test-api-generate-suggestions.js
node test-api-generate-suggestions-advanced.js
node test-api-update-canvas.js
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
   • Tiempo de generación: 1247ms
   • Conteo de palabras: 1543
   • Criterios de aceptación: 3
   • Casos de prueba: 5
   • Advertencias: 1
💾 Documento completo guardado en: analyze-result.json
```

### Test Configuration

#### Mock Strategy
The project uses comprehensive mocking for:
- **AI Providers**: OpenAI and Anthropic API calls
- **External Services**: HTTP requests and third-party APIs
- **Environment Variables**: API keys and configuration
- **File System**: Document storage and retrieval

#### Best Practices
1. **Type-Safe Mocks**: Leverage TypeScript for mock validation
2. **Comprehensive Coverage**: Test both success and failure scenarios
3. **Isolated Tests**: Each test runs independently
4. **Realistic Data**: Use production-like test data
5. **Performance Testing**: Include timing and concurrency tests

---

## 🔄 Provider Failover System

The system implements a robust circuit breaker pattern to ensure high availability by automatically switching between AI providers when failures occur.

### Key Components

#### 1. Circuit Breaker Pattern
- **Failure Counting**: Tracks consecutive failures for each provider
- **Circuit Opening**: When failures exceed threshold, circuit "opens" and stops requests
- **Automatic Reset**: Circuits automatically reset after configurable timeout
- **Manual Reset**: Circuits can be manually reset through API

#### 2. Provider Management
- **Primary Provider**: OpenAI (default)
- **Secondary Provider**: Anthropic (fallback)
- **Health Tracking**: Monitors provider status and performance
- **Priority Selection**: Selects providers based on circuit status and priority

#### 3. Retry Logic
- **Exponential Backoff**: Increases delay between retries
- **Configurable Retries**: Maximum retry attempts can be configured
- **Cross-Provider Retries**: Attempts with all available providers

### Failover Process

1. **Request Initiation**: Application makes AI provider request
2. **Provider Selection**: System selects highest priority available provider
3. **Request Execution**: Sends request to selected provider
4. **Success Handling**: Records success and returns result
5. **Failure Handling**:
   - Record failure for provider
   - Increment failure count
   - Open circuit if threshold exceeded
   - Try next available provider
   - Retry with exponential backoff
   - Return error if all providers fail

### API Functions

```typescript
// Structured object generation with failover
const result = await generateObjectWithFailover(
  schema,
  prompt,
  options
);

// Text generation with failover
const text = await generateTextWithFailover(
  prompt,
  options
);

// Streaming text with failover
const stream = await streamTextWithFailover(
  prompt,
  options
);
```

### Monitoring and Management

```typescript
// Check provider health status
const status = getProviderHealthStatus();

// Reset specific circuit breaker
resetCircuitBreaker('openai');

// Reset all circuit breakers
resetAllCircuitBreakers();
```

---

## 🚀 Deployment Guide

### System Requirements

- **OS**: Ubuntu 22.04 LTS (recommended)
- **Node.js**: 20.x or higher
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx (for SSL termination)
- **Memory**: Minimum 2GB RAM
- **Storage**: Minimum 10GB available space

### Production Deployment

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx
```

#### 2. Application Deployment

```bash
# Clone repository
git clone <repository-url>
cd super-qa-ai-backend

# Install dependencies
npm ci

# Build application
npm run build

# Configure environment
cp .env.example .env.production
# Edit .env.production with production values
```

#### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'qa-chatcanvas-api',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048'
  }]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```

---

## 📊 Performance & Monitoring

### Performance Metrics

- **Average Response Time**: ~1.2s for ticket analysis
- **Concurrent Requests**: Supports up to 100 concurrent requests
- **Memory Usage**: ~500MB base, ~1GB under load
- **Test Execution**: 254 tests in ~800ms

### Monitoring Tools

```bash
# PM2 monitoring
pm2 monit
pm2 logs --lines 100

# System monitoring
htop
iostat 1
netstat -tulpn
```

### Health Checks

```bash
# API health check
curl http://localhost:3000/api/health

# Provider status check
node -e "console.log(require('./lib/ai/providerFailover').getProviderHealthStatus())"
```

---

## 🔒 Security Considerations

### API Security

1. **API Key Management**
   - Store keys securely in environment variables
   - Rotate keys regularly
   - Use different keys for different environments
   - Monitor key usage and quotas

2. **Input Validation**
   - Validate all inputs using Zod schemas
   - Sanitize user inputs
   - Implement request size limits
   - Validate file uploads

### Infrastructure Security

```bash
# UFW firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Best Practices

- **Environment Separation**: Separate dev/staging/production environments
- **Secrets Management**: Use secure secret management systems
- **Audit Logging**: Log all security-relevant events
- **Regular Backups**: Backup configuration and data regularly

---

## 🛠️ Development Guide

### Development Setup

```bash
# Clone and setup
git clone <repository-url>
cd super-qa-ai-backend
npm install

# Setup environment
cp .env.example .env.local
# Add your API keys to .env.local

# Start development server
npm run dev
```

### Code Style and Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks

### Development Workflow

1. **Feature Development**
   ```bash
   git checkout -b feature/new-feature
   # Develop feature
   npm test
   npm run lint
   git commit -m "feat: add new feature"
   ```

2. **Testing**
   ```bash
   # Run all tests
   npm test
   
   # Run specific tests
   npm test -- src/__tests__/api/
   
   # Run with coverage
   npm run test:coverage
   
   # Test real APIs
   npm run dev
   node test-api-analyze-ticket.js
   ```

### Adding New Features

#### API Endpoints
```typescript
// src/app/api/new-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  // Define request schema
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    // Process request
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Processing failed' },
      { status: 500 }
    );
  }
}
```

---

## 📚 Additional Resources

### Documentation Files

- **[Testing Guide](docs/testing-guide.md)**: Comprehensive testing documentation
- **[Deployment Guide](docs/deployment.md)**: Detailed deployment instructions
- **[Provider Failover](docs/provider-failover.md)**: Failover system documentation
- **[AI SDK Update](docs/ai-sdk-update-summary.md)**: Migration to AI SDK v5
- **[Error Handling](docs/error-handling-fixes.md)**: Error handling improvements

### External Resources

- **[Vercel AI SDK](https://sdk.vercel.ai/)**: AI SDK documentation
- **[Next.js](https://nextjs.org/docs)**: Next.js documentation
- **[Vitest](https://vitest.dev/)**: Testing framework documentation
- **[Zod](https://zod.dev/)**: Schema validation documentation
- **[TypeScript](https://www.typescriptlang.org/docs/)**: TypeScript documentation

### API References

- **[OpenAI API](https://platform.openai.com/docs/api-reference)**: OpenAI API documentation
- **[Anthropic API](https://docs.anthropic.com/claude/reference/)**: Anthropic API documentation

---

## 📝 Recent Updates

### Jest to Vitest Migration (Completed)
- ✅ **Complete Migration**: All 254 tests migrated from Jest to Vitest
- ✅ **Zero Test Failures**: All tests passing with new framework
- ✅ **Performance Improvement**: ~800ms execution time (faster than Jest)
- ✅ **Enhanced Mocking**: Better ES modules support and type safety
- ✅ **Documentation Updated**: All references updated to Vitest

### AI SDK v5 Integration (Completed)
- ✅ **SDK Upgrade**: Updated to Vercel AI SDK v5
- ✅ **Message Transformation**: Updated message processing pipeline
- ✅ **Streaming Support**: Enhanced streaming response handling
- ✅ **Provider Failover**: Improved failover with new SDK
- ✅ **Type Safety**: Enhanced TypeScript integration

### Provider Failover Enhancement (Completed)
- ✅ **Circuit Breaker**: Robust circuit breaker implementation
- ✅ **Health Monitoring**: Real-time provider health tracking
- ✅ **Automatic Recovery**: Self-healing system capabilities
- ✅ **Manual Controls**: API for manual circuit management
- ✅ **Comprehensive Testing**: Full test coverage for failover scenarios

---

**Built with ❤️ using Next.js, TypeScript, and Vercel AI SDK**

*For questions, issues, or contributions, please refer to the project repository.*
