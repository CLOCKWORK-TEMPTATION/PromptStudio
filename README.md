# PromptStudio

A comprehensive AI Prompt Engineering Platform with SDK Auto-Generation, Cloud Deployment, Real-time Collaboration, and Semantic Caching capabilities.

## Features

### 🎨 Prompt Editor
- Visual prompt template editor with variable support
- Real-time prompt testing and preview
- Model configuration (temperature, max tokens, top_p, etc.)
- Support for multiple AI providers (OpenAI, Anthropic)
- Variable type definitions with validation

### 🔧 SDK Auto-Generation
Generate production-ready client code for your prompts:

#### Python SDK
- Async/sync mode selection
- Built-in retry logic with exponential backoff
- Custom exception classes for error handling
- TypedDict support for type hints
- Full docstrings and usage examples
- aiohttp/requests integration

#### TypeScript SDK
- Full TypeScript type definitions
- Async/await with fetch API
- Custom error classes
- Retry logic with configurable attempts
- Streaming response support
- Ready for npm publishing

### ☁️ Cloud Deployment
One-click deployment to major cloud platforms:

#### Vercel Edge Functions
- Edge Runtime for ultra-low latency
- Automatic HTTPS and global CDN
- Zero configuration deployment
- Rate limiting support

#### Cloudflare Workers
- 0ms cold start with V8 Isolates
- 300+ global edge locations
- KV storage for rate limiting
- Durable Objects support

#### AWS Lambda
- SAM template for easy deployment
- API Gateway integration
- ARM64 architecture for performance
- CloudWatch Logs integration
- VPC support

#### Google Cloud Functions
- 2nd gen (Cloud Run based)
- Secret Manager integration
- Cloud Logging
- Multi-region deployment

### 🤝 Live Collaboration
- **WebSocket-based real-time collaboration** - Edit prompts together in real-time
- **Remote cursor visualization** - See where other users are typing
- **CRDT-based concurrent editing** - Conflict-free simultaneous editing using Yjs
- **Presence awareness** - See who's online and their activity status
- **Typing indicators** - Know when others are actively typing
- **Comments & annotations** - Add comments to specific parts of your prompts
- **Session sharing** - Share sessions via link with customizable permissions
- **Role-based access control** - Owner, Editor, and Viewer roles
- **Edit history** - Track all changes with full version history
- **Snapshot management** - Create and restore named versions

### 💾 Semantic Caching
- **Enable/disable caching** - Control caching at the system level
- **Similarity-based matching** - Find semantically similar cached responses
- **Configurable similarity threshold** - Tune the match sensitivity (0.5-1.0)
- **TTL configuration** - Set expiration times for cache entries
- **Tag-based organization** - Categorize cache entries with tags
- **Cache invalidation rules** - Invalidate by tags, patterns, or age
- **Analytics dashboard** - Track hit rates, tokens saved, and cost savings
- **Cache management UI** - Browse, search, and delete cache entries

### 🔒 Security Features
- API Key authentication
- Rate limiting configuration
- Webhook notifications for events
- Request signing for webhooks

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Lucide React** - Icons
- **Socket.IO Client** - WebSocket client
- **Yjs** - CRDT client

### Backend
- **Node.js** + **Express** - API server
- **Socket.IO** - WebSocket server for real-time features
- **PostgreSQL** + **Prisma** - Database and ORM
- **Redis** - Caching and pub/sub
- **Yjs** - CRDT implementation for collaborative editing
- **OpenAI API** - Embedding generation for semantic search

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (for collaboration features)
- Redis 7+ (for caching features)
- npm or yarn

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/prompt-studio.git
cd prompt-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run type-check
```

## Project Structure

```
PromptStudio/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main page
│   │
│   ├── components/             # React components
│   │   ├── PromptEditor/       # Prompt editing UI
│   │   ├── SDKGenerator/       # SDK generation UI
│   │   ├── CloudDeployment/    # Cloud deployment UI
│   │   └── collaboration/      # Real-time collaboration
│   │
│   ├── lib/                    # Core libraries
│   │   ├── sdk-generator/      # SDK code generators
│   │   └── cloud-deployment/   # Deployment generators
│   │
│   ├── store/                  # State management (Zustand)
│   └── types/                  # TypeScript definitions
│
├── backend/                    # Backend services
│   ├── src/
│   │   ├── api/               # API routes
│   │   ├── websocket/         # WebSocket handlers
│   │   └── services/          # Business logic
│   └── prisma/                # Database schema
│
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## SDK Generation Options

### Python Options
| Option | Description | Default |
|--------|-------------|---------|
| `asyncMode` | Use async/await with aiohttp | `true` |
| `includeRetryLogic` | Add exponential backoff retry | `true` |
| `includeErrorHandling` | Custom exception classes | `true` |
| `functionName` | Main function name | `generate_response` |
| `className` | Client class name | `PromptClient` |
| `includeTypes` | Add TypedDict definitions | `true` |
| `retryAttempts` | Max retry attempts | `3` |
| `timeout` | Request timeout (ms) | `30000` |

### TypeScript Options
| Option | Description | Default |
|--------|-------------|---------|
| `asyncMode` | Use async/await | `true` |
| `includeRetryLogic` | Add retry helper function | `true` |
| `includeErrorHandling` | Custom error classes | `true` |
| `functionName` | Main method name | `generateResponse` |
| `className` | Client class name | `PromptClient` |
| `includeTypes` | Generate interfaces | `true` |
| `retryAttempts` | Max retry attempts | `3` |
| `timeout` | Request timeout (ms) | `30000` |

## Deployment Configuration

### Common Options
| Option | Description |
|--------|-------------|
| `name` | Deployment name |
| `region` | Cloud region |
| `environment` | dev/staging/production |
| `timeout` | Function timeout (seconds) |
| `memory` | Memory allocation (MB) |

### Rate Limiting
| Option | Description |
|--------|-------------|
| `requestsPerMinute` | Limit per minute |
| `requestsPerHour` | Limit per hour |
| `requestsPerDay` | Limit per day |
| `burstLimit` | Concurrent request limit |

### Webhooks
| Event | Description |
|-------|-------------|
| `request.started` | Request received |
| `request.completed` | Successful response |
| `request.failed` | Request error |
| `rate_limit.exceeded` | Rate limit hit |
| `error.occurred` | System error |

## API Endpoints

### Sessions
- `GET /api/sessions` - List user's sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session details
- `PATCH /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Cache
- `GET /api/cache/config` - Get cache config
- `PATCH /api/cache/config` - Update cache config
- `POST /api/cache/lookup` - Lookup cache entry
- `GET /api/cache/analytics` - Get cache analytics

## WebSocket Events

### Collaboration Events
- `join_session` - Join a collaboration session
- `leave_session` - Leave a session
- `edit_operation` - Send CRDT update
- `cursor_move` - Update cursor position
- `sync_state` - Receive full state sync

### Presence Events
- `user_joined` - User joined session
- `user_left` - User left session
- `presence_update` - Presence list update
- `cursor_update` - Remote cursor update

## License

MIT License - see LICENSE file for details.
