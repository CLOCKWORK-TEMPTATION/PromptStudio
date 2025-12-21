import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { setupWebSocket } from './websocket/index.js';
import { authRouter } from './api/routes/auth.js';
import { sessionRouter } from './api/routes/sessions.js';
import { cacheRouter } from './api/routes/cache.js';
import { translationRouter } from './api/routes/translation.js';
import promptRoutes from './api/routes/prompts.js';
import ragRoutes from './api/routes/rag.js';
import chainRoutes from './api/routes/chains.js';
import reasoningRoutes from './api/routes/reasoning.js';
import refinementRoutes from './api/routes/refinement.js';
import predictionRoutes from './api/routes/prediction.js';
import qualityRoutes from './api/routes/quality.js';
import agentsRoutes from './api/routes/agents';
import templatesRoutes from './api/routes/templates.js';
import datasetsRoutes from './api/routes/datasets.js';
import evalsRoutes from './api/routes/evals.js';
import optimizeRoutes from './api/routes/optimize.js';
import advancedEvalsRoutes from './api/routes/advancedEvals.js';
import rubricsRoutes from './api/routes/rubrics.js';
import runsRoutes from './api/routes/runs.js';
import budgetRoutes from './api/routes/budget.js';
import auditRoutes from './api/routes/audit.js';
import observabilityRoutes from './api/routes/observability.js';
import techniquesRoutes from './api/routes/techniques.js';
import critiqueRoutes from './api/routes/critique.js';
import sharingRoutes from './api/routes/sharing.js';
import importExportRoutes from './api/routes/importExport.js';
import commentsRoutes from './api/routes/comments.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { rateLimiter } from './api/middleware/rateLimiter.js';
import { authMiddleware } from './api/middleware/auth.js';
import { healthCheckService, requestTrackingMiddleware } from './services/HealthCheckService.js';

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
app.use(requestTrackingMiddleware);

// Health check endpoint (before auth middleware)
app.get('/health', (req, res) => healthCheckService.healthCheckHandler(req, res));

// Simple status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', authMiddleware, sessionRouter);
app.use('/api/cache', authMiddleware, cacheRouter);
app.use('/api/translation', translationRouter);
app.use('/api/prompts', promptRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/chains', chainRoutes);
app.use('/api/reasoning', reasoningRoutes);
app.use('/api/refinement', refinementRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/datasets', datasetsRoutes);
app.use('/api/evals', evalsRoutes);
app.use('/api/optimize', rateLimiter, optimizeRoutes);
app.use('/api/advanced-evals', rateLimiter, advancedEvalsRoutes);
app.use('/api/rubrics', rubricsRoutes);
app.use('/api/runs', runsRoutes);
app.use('/api/budget', rateLimiter, budgetRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/observability', observabilityRoutes);
app.use('/api/techniques', techniquesRoutes);
app.use('/api/critique', rateLimiter, critiqueRoutes);
app.use('/api/share', sharingRoutes);
app.use('/api', importExportRoutes);
app.use('/api/comments', commentsRoutes);

// Error handler
app.use(errorHandler);

// Setup WebSocket handlers
setupWebSocket(io);

// Track WebSocket connections
io.on('connection', (socket) => {
  const connectionCount = io.engine.clientsCount;
  healthCheckService.setActiveConnections(connectionCount);
  
  socket.on('disconnect', () => {
    const connectionCount = io.engine.clientsCount;
    healthCheckService.setActiveConnections(connectionCount);
  });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 PromptStudio Backend running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🤖 Agent Orchestration System: ACTIVE`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  // Close WebSocket server
  io.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // Cleanup health check service
  await healthCheckService.cleanup();
  console.log('✅ Health check service cleaned up');
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  // Close WebSocket server
  io.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // Cleanup health check service
  await healthCheckService.cleanup();
  console.log('✅ Health check service cleaned up');
  
  process.exit(0);
});

export { io };
