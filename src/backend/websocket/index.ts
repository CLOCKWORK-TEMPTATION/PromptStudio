import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { CollaborationManager } from './managers/CollaborationManager.js';
import { PresenceManager } from './managers/PresenceManager.js';
import { CRDTManager } from './managers/CRDTManager.js';
import { handleCollaborationEvents } from './handlers/collaborationHandlers.js';
import { handlePresenceEvents } from './handlers/presenceHandlers.js';
import { handleCommentEvents } from './handlers/commentHandlers.js';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
  userEmail: string;
  userColor: string;
}

// Managers instances
export const collaborationManager = new CollaborationManager();
export const presenceManager = new PresenceManager();
export const crdtManager = new CRDTManager();

export function setupWebSocket(io: SocketIOServer): void {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token as string, config.jwt.secret) as {
        userId: string;
        email: string;
        name: string;
        color?: string;
      };

      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).userName = decoded.name;
      (socket as AuthenticatedSocket).userEmail = decoded.email;
      (socket as AuthenticatedSocket).userColor = decoded.color || '#3B82F6';

      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;

    console.log(`🔌 User connected: ${authSocket.userName} (${authSocket.userId})`);

    // Register event handlers
    handleCollaborationEvents(io, authSocket, collaborationManager, crdtManager);
    handlePresenceEvents(io, authSocket, presenceManager);
    handleCommentEvents(io, authSocket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${authSocket.userName} - ${reason}`);

      // Clean up presence
      const sessions = presenceManager.getUserSessions(authSocket.userId);
      sessions.forEach(sessionId => {
        presenceManager.removeUser(sessionId, authSocket.userId);

        // Notify other users in the session
        socket.to(sessionId).emit('user_left', {
          userId: authSocket.userId,
          userName: authSocket.userName,
          timestamp: Date.now(),
        });
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for user ${authSocket.userId}:`, error);
    });
  });

  console.log('✅ WebSocket handlers initialized');
}
