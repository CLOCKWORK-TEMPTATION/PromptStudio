# PromptStudio Project Structure

## Architecture Overview
PromptStudio follows a hybrid monorepo architecture combining Next.js frontend with Express.js backend, supporting both integrated and standalone deployment modes. The project uses a feature-based organization with clear separation between frontend components, backend services, and shared utilities.

## Root Directory Structure

```
PromptStudio-main/
├── src/                        # Main source code
├── prisma/                     # Database schema and migrations
├── supabase/                   # Supabase-specific migrations
├── shared/                     # Shared type definitions
├── docs/                       # Documentation files
├── public/                     # Static assets
├── .github/                    # GitHub workflows and agents
├── .amazonq/                   # Amazon Q configuration
└── Configuration files         # Package.json, Docker, etc.
```

## Core Source Structure (`src/`)

### Frontend Architecture (`src/app/`, `src/components/`, `src/features/`)

**Next.js App Router (`src/app/`):**
- `layout.tsx` - Root application layout with providers
- `page.tsx` - Main application entry point
- `globals.css` - Global styling and Tailwind imports

**Component Organization (`src/components/`):**
- `PromptEditor/` - Core prompt editing interface components
- `SDKGenerator/` - SDK generation UI and configuration
- `CloudDeployment/` - Cloud deployment interface and wizards
- `Layout/` - Application layout and navigation components
- Individual components for specialized features (translation, export, etc.)

**Feature Modules (`src/features/`):**
- `Editor/` - Advanced prompt editing capabilities
- `Testing/` - Prompt testing and validation tools
- `Chains/` - Prompt chaining and workflow management
- `Templates/` - Template management and marketplace
- `History/` - Version control and history tracking
- `Settings/` - Application configuration and preferences
- `Techniques/` - Prompt engineering techniques and patterns
- `Marketplace/` - Community templates and sharing

### Backend Architecture (`src/backend/`)

**API Layer (`src/backend/api/`):**
- RESTful API endpoints for core functionality
- Authentication and authorization middleware
- Request validation and error handling

**Service Layer (`src/backend/services/`):**
- Business logic implementation
- External API integrations (OpenAI, Anthropic)
- Advanced services (RAG, Bayesian optimization, prompt chaining)

**WebSocket Layer (`src/backend/websocket/`):**
- Real-time collaboration infrastructure
- CRDT synchronization using Yjs
- Presence and cursor tracking

**Configuration (`src/backend/config/`):**
- Environment-specific configurations
- Database connection settings
- External service configurations

### Shared Libraries (`src/lib/`)

**SDK Generation (`src/lib/sdk-generator/`):**
- Template engines for Python and TypeScript
- Code generation utilities and formatters
- Language-specific optimization patterns

**Cloud Deployment (`src/lib/cloud-deployment/`):**
- Platform-specific deployment templates
- Infrastructure-as-code generators
- Configuration management utilities

### State Management (`src/store/`, `src/stores/`)

**Global State (`src/store/`):**
- Translation and internationalization state
- Application-wide configuration

**Feature State (`src/stores/`):**
- Editor-specific state management
- Application state with Zustand

### Service Layer (`src/services/`)
- `promptService.ts` - Core prompt management
- `translationService.ts` - Multi-language support
- `cacheService.ts` - Semantic caching implementation
- `analysisService.ts` - Prompt analysis and optimization
- `exportService.ts` - Data export and import
- `templateService.ts` - Template management
- `predictionService.ts` - AI-powered predictions
- `LLMServiceAdapter.ts` - Multi-provider LLM integration

## Database Architecture

### Prisma Schema (`prisma/`)
- `schema.prisma` - Main database schema definition
- `migrations/` - Database migration history
- `init.sql` - Initial database setup

### Supabase Integration (`supabase/`)
- `migrations/` - Supabase-specific migrations
- Initial schema and seed data for templates and techniques

## Shared Type System (`shared/types/`)
- `api.ts` - API request/response types
- `cache.ts` - Caching system types
- `collaboration.ts` - Real-time collaboration types
- `prediction.ts` - AI prediction and analysis types

## Frontend Alternative (`src/frontend/`)
Alternative Vite-based frontend implementation:
- `components/` - React components
- `features/` - Feature-specific modules
- `pages/` - Page components
- `services/` - Frontend service layer
- `store/` - State management
- `lib/` - Utility libraries

## Configuration & Infrastructure

### Development Configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `next.config.js` - Next.js configuration
- `vite.config.ts` - Vite configuration
- `tailwind.config.ts` - Tailwind CSS configuration

### Deployment Configuration
- `Dockerfile` - Multi-stage container build
- `docker-compose.yml` - Local development environment
- `vercel.json` - Vercel deployment configuration
- `netlify.toml` - Netlify deployment settings

### Development Tools
- `eslint.config.js` - Code linting rules
- `postcss.config.js` - CSS processing configuration
- Start scripts for different platforms (`start.sh`, `start.bat`)

## Key Architectural Patterns

### Monorepo Structure
- Unified codebase with clear module boundaries
- Shared type definitions across frontend and backend
- Consistent tooling and configuration

### Feature-Based Organization
- Self-contained feature modules with their own components, services, and types
- Clear separation of concerns between UI, business logic, and data access
- Modular architecture supporting independent development and testing

### Service-Oriented Backend
- Layered architecture with clear API, service, and data access layers
- Dependency injection and configuration management
- Extensible service architecture for adding new AI providers

### Real-Time Collaboration Architecture
- WebSocket-based real-time communication
- CRDT implementation for conflict-free concurrent editing
- Presence and awareness system for multi-user collaboration

### Multi-Platform Deployment Support
- Platform-agnostic core with platform-specific adapters
- Infrastructure-as-code generation for major cloud providers
- Containerized deployment with Docker support