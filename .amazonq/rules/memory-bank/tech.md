# PromptStudio Technology Stack

## Programming Languages & Versions

### Primary Languages
- **TypeScript 5.9.3** - Primary language for type-safe development
- **JavaScript (ES2022)** - Runtime execution and legacy compatibility
- **SQL** - Database queries and migrations
- **CSS3** - Styling with Tailwind CSS framework

### Runtime Requirements
- **Node.js 18+** - JavaScript runtime environment
- **PostgreSQL 15+** - Primary database for collaboration features
- **Redis 7+** - Caching and pub/sub messaging

## Frontend Technology Stack

### Core Framework
- **Next.js 16.0.0** - React framework with App Router
- **React 19.0.0** - UI library with latest concurrent features
- **React DOM 19.0.0** - DOM rendering and hydration

### UI & Styling
- **Tailwind CSS 3.3.0** - Utility-first CSS framework
- **Radix UI** - Headless UI component library
  - Avatar, Dialog, Dropdown Menu, Label, Popover
  - Scroll Area, Select, Slider, Switch, Tabs
  - Toast, Tooltip components
- **Lucide React 0.294.0** - Icon library
- **Framer Motion 10.17.4** - Animation and gesture library

### State Management & Data
- **Zustand 4.4.0** - Lightweight state management
- **Zod 3.22.0** - Schema validation and type inference
- **Date-fns 3.0.6** - Date manipulation utilities

### Development Tools
- **Vite 5.0.10** - Build tool and development server
- **PostCSS 8.4.0** - CSS processing and optimization
- **Autoprefixer 10.4.0** - CSS vendor prefixing

## Backend Technology Stack

### Core Server
- **Express.js 4.18.2** - Web application framework
- **Node.js** - Server runtime environment
- **CORS 2.8.5** - Cross-origin resource sharing

### Database & ORM
- **Prisma 5.7.0** - Database ORM and query builder
- **@prisma/client 5.7.0** - Type-safe database client
- **PostgreSQL** - Primary relational database

### Caching & Messaging
- **Redis (IORedis 5.3.2)** - In-memory data structure store
- **Pub/Sub messaging** - Real-time event distribution

### Real-Time Communication
- **Socket.IO 4.7.2** - WebSocket server implementation
- **Socket.IO Client 4.7.2** - WebSocket client library
- **Yjs 13.6.10** - CRDT implementation for collaborative editing

### AI & ML Integration
- **OpenAI API 4.24.0** - GPT models and embedding generation
- **Custom LLM adapters** - Multi-provider AI integration
- **Vector similarity search** - Semantic caching implementation

## Development & Build Tools

### TypeScript Configuration
- **TypeScript 5.9.3** - Static type checking
- **TSX 4.7.0** - TypeScript execution for development
- **Multiple tsconfig files** - Separate configs for frontend/backend

### Code Quality & Linting
- **ESLint 8.0.0** - JavaScript/TypeScript linting
- **@typescript-eslint/eslint-plugin 6.15.0** - TypeScript-specific rules
- **@typescript-eslint/parser 6.15.0** - TypeScript AST parser
- **eslint-config-next 16.0.0** - Next.js ESLint configuration
- **eslint-plugin-react-hooks 4.6.0** - React Hooks linting
- **eslint-plugin-react-refresh 0.4.5** - React Fast Refresh support

### Authentication & Security
- **JSON Web Tokens (jsonwebtoken 9.0.2)** - Authentication tokens
- **API key authentication** - Secure API access
- **Rate limiting** - Request throttling and protection

## Utility Libraries

### File & Data Processing
- **File-saver 2.0.5** - Client-side file downloads
- **UUID 9.0.0** - Unique identifier generation
- **Handlebars 4.7.8** - Template engine for code generation

### UI Enhancement
- **React Syntax Highlighter 15.5.0** - Code syntax highlighting
- **PrismJS 1.29.0** - Syntax highlighting engine
- **Recharts 2.10.3** - Data visualization and charts
- **Class Variance Authority 0.7.0** - CSS class management
- **clsx 2.0.0** - Conditional CSS class names
- **Tailwind Merge 2.2.0** - Tailwind class merging utility

### Routing & Navigation
- **React Router DOM 6.21.1** - Client-side routing

## Development Commands & Scripts

### Primary Development
```bash
npm run dev              # Next.js development server
npm run build            # Production build
npm start               # Production server
npm run lint            # ESLint code checking
npm run type-check      # TypeScript type checking
```

### Backend Development
```bash
npm run backend:dev     # Backend development with tsx watch
npm run backend:build   # Backend TypeScript compilation
```

### Frontend Alternative (Vite)
```bash
npm run frontend:dev    # Vite development server
npm run frontend:build  # Vite production build
```

### Database Management
```bash
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run database migrations
npm run db:push         # Push schema changes to database
```

## Deployment & Infrastructure

### Containerization
- **Docker** - Multi-stage container builds
- **Docker Compose** - Local development environment
- **Dockerfile configurations** - Separate frontend/backend containers

### Cloud Platform Support
- **Vercel** - Edge Functions deployment
- **Netlify** - Static site deployment with functions
- **Cloudflare Workers** - Edge computing platform
- **AWS Lambda** - Serverless function deployment
- **Google Cloud Functions** - Serverless computing

### Configuration Management
- **Environment variables** - Configuration via .env files
- **dotenv 16.3.1** - Environment variable loading
- **Platform-specific configs** - Vercel, Netlify, Docker configurations

## Type System & Validation

### Type Definitions
- **Comprehensive TypeScript types** - Full type coverage
- **Shared type definitions** - Cross-platform type consistency
- **Runtime validation** - Zod schema validation
- **API type safety** - End-to-end type safety

### Code Generation
- **Template-based generation** - SDK and deployment code generation
- **Multi-language support** - Python, TypeScript, cURL generation
- **Configurable options** - Customizable generation parameters

## Performance & Optimization

### Caching Strategy
- **Semantic caching** - Vector-based similarity matching
- **Redis caching** - High-performance in-memory caching
- **CDN integration** - Global content delivery

### Build Optimization
- **Tree shaking** - Unused code elimination
- **Code splitting** - Dynamic imports and lazy loading
- **Asset optimization** - Image and resource optimization
- **Bundle analysis** - Performance monitoring and optimization