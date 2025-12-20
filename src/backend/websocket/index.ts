// @ts-expect-error - socket.io types not installed
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, callback: (data: any) => void) => this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit: (event: string, data: any) => boolean;
  join: (room: string) => void;
  leave: (room: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: (room: string) => { emit: (event: string, data: any) => boolean };
  handshake: { auth: { token?: string }; query: { token?: string } };
}

// Managers instances
export const collaborationManager = new CollaborationManager();
export const presenceManager = new PresenceManager();
export const crdtManager = new CRDTManager();

export function setupWebSocket(io: SocketIOServer): void {
  // Authentication middleware
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token || typeof token !== 'string') {
        console.warn(`[WebSocket] Connection attempt without valid token from ${socket.handshake.address}`);
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        email: string;
        name: string;
        color?: string;
      };

      if (!decoded.userId) {
        return next(new Error('Invalid token payload'));
      }

      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).userName = decoded.name;
      (socket as AuthenticatedSocket).userEmail = decoded.email;
      (socket as AuthenticatedSocket).userColor = decoded.color || '#3B82F6';

      next();
    } catch (error) {
      console.error(`[WebSocket] Auth failed for ${socket.handshake.address}:`, error instanceof Error ? error.message : 'Unknown error');
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
    socket.on('disconnect', (reason: string) => {
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
    socket.on('error', (error: Error) => {
      console.error(`Socket error for user ${authSocket.userId}:`, error);
    });
  });

  console.log('✅ WebSocket handlers initialized');
}
