# PromptStudio

Real-time collaborative prompt engineering platform with semantic caching capabilities.

## Features

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

## Tech Stack

### Backend
- **Node.js** + **Express** - API server
- **Socket.IO** - WebSocket server for real-time features
- **PostgreSQL** + **Prisma** - Database and ORM
- **Redis** - Caching and pub/sub
- **Yjs** - CRDT implementation for collaborative editing
- **OpenAI API** - Embedding generation for semantic search
- **TypeScript** - Type safety throughout

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.IO Client** - WebSocket client
- **Yjs** - CRDT client
- **Recharts** - Data visualization

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm or yarn

### Quick Start with Docker

```bash
# Start all services
docker-compose up -d

# The application will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### Manual Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/PromptStudio.git
cd PromptStudio
```

2. **Install backend dependencies**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
```

3. **Setup database**
```bash
npm run db:generate
npm run db:push
```

4. **Start backend**
```bash
npm run dev
```

5. **Install frontend dependencies** (new terminal)
```bash
cd frontend
npm install
```

6. **Start frontend**
```bash
npm run dev
```

7. **Open the application**
Navigate to `http://localhost:3000`

## Environment Variables

### Backend (.env)
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/promptstudio"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# OpenAI (for semantic caching)
OPENAI_API_KEY="your-openai-api-key"

# Collaboration
MAX_USERS_PER_SESSION=50
SESSION_TIMEOUT_MINUTES=60

# Cache
CACHE_TTL_SECONDS=3600
SIMILARITY_THRESHOLD=0.85
```

## Project Structure

```
PromptStudio/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/      # API routes
│   │   │   └── middleware/  # Express middleware
│   │   ├── websocket/
│   │   │   ├── handlers/    # WebSocket event handlers
│   │   │   └── managers/    # Session/presence managers
│   │   ├── services/        # Business logic
│   │   ├── lib/             # Shared utilities
│   │   └── config/          # Configuration
│   └── prisma/              # Database schema
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   └── collaboration/
│   │   ├── pages/           # Page components
│   │   ├── store/           # Zustand stores
│   │   ├── services/        # API & WebSocket services
│   │   └── lib/             # Utilities
│   └── public/              # Static assets
├── shared/
│   └── types/               # Shared TypeScript types
└── docker-compose.yml       # Docker services
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/guest` - Guest login
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update profile

### Sessions
- `GET /api/sessions` - List user's sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session details
- `PATCH /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `GET /api/sessions/share/:token` - Get session by share token
- `POST /api/sessions/:id/members` - Invite member
- `GET /api/sessions/:id/history` - Get edit history
- `POST /api/sessions/:id/snapshots` - Create snapshot

### Cache
- `GET /api/cache/config` - Get cache config
- `PATCH /api/cache/config` - Update cache config
- `POST /api/cache/lookup` - Lookup cache entry
- `POST /api/cache/store` - Store cache entry
- `GET /api/cache/entries` - List cache entries
- `GET /api/cache/analytics` - Get cache analytics
- `POST /api/cache/invalidate` - Invalidate entries
- `POST /api/cache/cleanup` - Cleanup expired entries

## WebSocket Events

### Collaboration Events
- `join_session` - Join a collaboration session
- `leave_session` - Leave a session
- `edit_operation` - Send CRDT update
- `cursor_move` - Update cursor position
- `sync_state` - Receive full state sync

### Comment Events
- `comment_add` - Add a comment
- `comment_update` - Update a comment
- `comment_delete` - Delete a comment
- `comment_resolve` - Resolve/unresolve comment

### Presence Events
- `user_joined` - User joined session
- `user_left` - User left session
- `presence_update` - Presence list update
- `cursor_update` - Remote cursor update

## License

MIT
