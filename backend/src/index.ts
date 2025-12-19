import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { setupWebSocket } from './websocket/index.js';
import { authRouter } from './api/routes/auth.js';
import { sessionRouter } from './api/routes/sessions.js';
import { cacheRouter } from './api/routes/cache.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { authMiddleware } from './api/middleware/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', authMiddleware, sessionRouter);
app.use('/api/cache', authMiddleware, cacheRouter);

// Error handler
app.use(errorHandler);

// Setup WebSocket handlers
setupWebSocket(io);

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 PromptStudio Backend running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { io };
