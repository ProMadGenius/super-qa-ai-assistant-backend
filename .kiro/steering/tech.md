# Technology Stack & Build System

## Core Technologies

### Framework & Runtime
- **Next.js 15**: App Router with Route Handlers for API endpoints
- **TypeScript 5**: Strict typing throughout the codebase
- **Node.js 20+**: Runtime environment
- **React 18**: Frontend components (minimal usage, primarily API-focused)

### AI & Data Validation
- **Vercel AI SDK v5**: Primary AI integration layer
  - `generateObject` for structured output generation
  - `streamText` for conversational interactions
  - `convertToModelMessages` for message format handling
- **Zod**: Schema validation and type generation
- **OpenAI GPT-4o**: Primary AI model (with Anthropic Claude as fallback)

### Testing & Quality
- **Jest 29**: Testing framework with Next.js integration
- **Supertest**: API endpoint testing
- **ESLint**: Code linting with Next.js configuration

## Build & Development Commands

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run in development mode with hot reload
# Server runs on http://localhost:3000
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Tests are located in src/__tests__/ with .test.ts extension
```

### Production Build
```bash
# Build for production
npm run build

# Start production server
npm start

# Build creates standalone output for deployment
```

### Deployment
```bash
# PM2 deployment (Ubuntu 22)
npm run build
pm2 start ecosystem.config.js

# Vercel deployment (recommended)
# Automatic deployment via Git integration
```

## Environment Configuration

### Required Environment Variables
```bash
# AI Provider Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Optional fallback

# Environment
NODE_ENV=development|production

# API Configuration  
API_BASE_URL=http://localhost:3000  # Development
```

## Key Dependencies

### Production Dependencies
- `ai ^4.0.0` - Vercel AI SDK
- `@ai-sdk/openai ^1.0.0` - OpenAI provider
- `@ai-sdk/anthropic ^1.0.0` - Anthropic provider  
- `zod ^3.22.0` - Schema validation
- `next ^15.0.0` - Framework
- `react ^18.0.0` - UI library

### Development Dependencies
- `typescript ^5.0.0` - Type checking
- `jest ^29.0.0` - Testing framework
- `@types/*` - TypeScript definitions
- `eslint` - Code linting