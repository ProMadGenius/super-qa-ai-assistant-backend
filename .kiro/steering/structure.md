# Project Structure & Organization

## Directory Layout

```
qa-chatcanvas-backend/
├── src/                          # Source code
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Route Handlers
│   │   │   └── analyze-ticket/   # Ticket analysis endpoint
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page
│   ├── lib/                      # Shared utilities and schemas
│   │   └── schemas/              # Zod schemas and types
│   └── __tests__/                # Test files
│       ├── api/                  # API endpoint tests
│       └── schemas/              # Schema validation tests
├── example/                      # Sample data and configurations
├── .kiro/                        # Kiro AI assistant configuration
│   └── steering/                 # Project guidance documents
├── .env.example                  # Environment template
├── .env.local                    # Local environment (gitignored)
└── Configuration files           # Next.js, TypeScript, Jest, etc.
```

## Code Organization Patterns

### API Routes (`src/app/api/`)
- **Route Handlers**: Use Next.js App Router pattern with `route.ts` files
- **Single Responsibility**: Each endpoint handles one specific operation
- **Error Handling**: Consistent error response format with proper HTTP status codes
- **Validation**: All inputs validated using Zod schemas before processing

### Schema Management (`src/lib/schemas/`)
- **Centralized Schemas**: All Zod schemas in dedicated files
- **Type Exports**: Export both schema and inferred TypeScript types
- **Validation Helpers**: Include validation functions alongside schemas
- **Index File**: Re-export all schemas from `index.ts` for clean imports

### Testing Structure (`src/__tests__/`)
- **Mirror Source Structure**: Test files mirror the `src/` directory structure
- **Naming Convention**: Use `.test.ts` suffix for all test files
- **API Testing**: Use Supertest for endpoint integration tests
- **Schema Testing**: Validate schema behavior with various inputs

## File Naming Conventions

### API Routes
- `route.ts` - Next.js Route Handler convention
- Use kebab-case for directory names (`analyze-ticket/`)
- HTTP method functions: `GET`, `POST`, `PUT`, `DELETE`

### Schemas
- PascalCase for schema files (`QAProfile.ts`, `JiraTicket.ts`)
- Schema variable names end with `Schema` (`qaProfileSchema`)
- Type exports use the base name (`QAProfile`)

### Tests
- Match source file name with `.test.ts` suffix
- Group related tests in describe blocks
- Use descriptive test names that explain the expected behavior

## Import/Export Patterns

### Schema Imports
```typescript
// Preferred: Import from index
import { qaProfileSchema, type QAProfile } from '@/lib/schemas'

// Avoid: Direct file imports
import { qaProfileSchema } from '@/lib/schemas/QAProfile'
```

### API Route Structure
```typescript
// Standard Route Handler pattern
import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function POST(request: NextRequest) {
  // Implementation
}
```

## Configuration Files

### TypeScript (`tsconfig.json`)
- Strict mode enabled
- Path mapping: `@/*` points to `src/*`
- Target ES2017 for Node.js compatibility

### Next.js (`next.config.js`)
- Standalone output for deployment
- External packages configuration for AI SDK

### Jest (`jest.config.js`)
- Next.js integration with `next/jest`
- Node environment for API testing
- Path mapping aligned with TypeScript

## Data Flow Architecture

### Request Processing
1. **Validation Layer**: Zod schema validation at API entry points
2. **Business Logic**: AI SDK integration and data processing
3. **Response Formatting**: Consistent JSON response structure
4. **Error Handling**: Centralized error response patterns

### Schema Validation Flow
1. **Input Validation**: Validate request payloads against schemas
2. **AI Generation**: Use validated data for AI model calls
3. **Output Validation**: Validate AI responses against output schemas
4. **Type Safety**: Maintain TypeScript types throughout the pipeline