# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromptStudio is an AI Prompt Engineering Platform with SDK auto-generation, cloud deployment, real-time collaboration, and semantic caching capabilities. It combines a Next.js frontend with an Express/Socket.IO backend.

## Development Commands

```bash
# Frontend (Next.js)
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run type-check       # Run TypeScript type checking
npm run lint             # Run ESLint

# Backend
npm run backend:dev      # Start backend with hot reload (tsx watch)
npm run backend:build    # Build backend TypeScript

# Database (Prisma)
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:push          # Push schema to database
```

## Architecture

### Frontend Structure (`src/`)
- **src/app/**: Next.js App Router (layout.tsx, page.tsx)
- **src/components/**: React components organized by feature
  - `CloudDeployment/`: Cloud provider deployment UI
  - `SDKGenerator/`: SDK code generation UI
  - `collaboration/`: Real-time collaboration components
  - `Layout/`: Header, Sidebar, MainLayout
- **src/features/**: Feature modules (Editor, History, Marketplace, Templates, Testing, Chains)
- **src/lib/**: Core generators
  - `sdk-generator/`: Python/TypeScript SDK code generators
  - `cloud-deployment/`: Vercel, Cloudflare, AWS Lambda, GCP Functions generators
- **src/store/**: Zustand state management (usePromptStudioStore)
- **src/types/**: TypeScript type definitions

### Backend Structure (`src/backend/`)
- **api/routes/**: Express route handlers (auth, cache, chains, prompts, sessions, etc.)
- **api/middleware/**: Auth, error handling, safety middleware
- **services/**: Business logic services
  - `AdaptiveRAGService.ts`: RAG with dynamic context
  - `SemanticCacheService.ts`: Similarity-based caching
  - `PromptChainService.ts`: Multi-step prompt chains
  - `LLMServiceAdapter.ts`: OpenAI API integration
  - `SelfRefinementService.ts`: Prompt optimization
- **websocket/**: Socket.IO real-time features
  - `managers/`: CollaborationManager, PresenceManager, CRDTManager
  - `handlers/`: Event handlers for collaboration, presence, comments
- **lib/**: Prisma client, Redis client

### Database (Prisma)
Schema at `prisma/schema.prisma` includes:
- Users, CollaborationSessions, SessionMembers
- SemanticCache with vector embeddings
- MarketplacePrompt with hierarchical prompt structure
- KnowledgeBase and KnowledgeDocument for RAG
- PromptChain and ChainExecution for multi-step processing
- LongTermMemory for persistent context

## Key Patterns

### State Management
Uses Zustand store (`src/store/index.ts`) with:
- Current prompt configuration
- SDK generation options (Python/TypeScript)
- Deployment configurations per provider
- UI state (active tab)

### WebSocket Authentication
JWT token passed via `socket.handshake.auth.token`. AuthenticatedSocket extends Socket with userId, userName, userEmail, userColor.

### Path Aliases
- `@/*` maps to `./src/*`
- `@shared/*` maps to `../shared/*`

### SDK Generation
Generates production-ready code with:
- Async/sync modes
- Retry logic with exponential backoff
- Custom error handling
- Type definitions

### Cloud Deployment
Generates deployment packages for:
- Vercel Edge Functions
- Cloudflare Workers
- AWS Lambda (SAM templates)
- GCP Cloud Functions

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `OPENAI_API_KEY`: For embeddings and LLM calls
- `JWT_SECRET`: For authentication

Optional:
- `FRONTEND_URL`: For CORS configuration (default: http://localhost:3000)

## Tech Stack

- **Frontend**: Next.js 14+, React 19, TypeScript, Tailwind CSS, Zustand, Lucide React, Socket.IO Client, Yjs (CRDT)
- **Backend**: Node.js, Express, Socket.IO, Prisma, PostgreSQL, Redis, Zod
- **APIs**: OpenAI (embeddings, completions)
