import { Server as SocketIOServer } from 'socket.io';
import * as Y from 'yjs';
import type { AuthenticatedSocket } from '../index.js';
import type { CollaborationManager } from '../managers/CollaborationManager.js';
import type { CRDTManager } from '../managers/CRDTManager.js';
import { presenceManager } from '../index.js';
import prisma from '../../lib/prisma.js';
import { CollaborationEvent } from '../../../../shared/types/collaboration.js';

export function handleCollaborationEvents(
  io: SocketIOServer,
  socket: AuthenticatedSocket,
  collaborationManager: CollaborationManager,
  crdtManager: CRDTManager
): void {
  // Join session
  socket.on(CollaborationEvent.JOIN_SESSION, async (data: { sessionId: string; shareToken?: string }) => {
    try {
      const { sessionId, shareToken } = data;

      // Verify session exists
      let session = await collaborationManager.getSession(sessionId);

      // Try by share token if provided
      if (!session && shareToken) {
        session = await collaborationManager.getSessionByShareToken(shareToken);
      }

      if (!session) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        });
        return;
      }

      // Check permissions
      const userRole = await collaborationManager.getUserRole(session.id, socket.userId);

      if (!userRole && !shareToken) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this session',
        });
        return;
      }

      // Join as viewer if coming via share link
      if (!userRole && shareToken) {
        await collaborationManager.joinSession(session.id, socket.userId, 'VIEWER');
      } else {
        await collaborationManager.joinSession(session.id, socket.userId, userRole);
      }

      // Join socket room
      socket.join(session.id);

      // Add to presence
      presenceManager.addUser(session.id, {
        id: socket.userId,
        email: socket.userEmail,
        name: socket.userName,
        color: socket.userColor,
      }, socket.id);

      // Get CRDT document state
      const doc = await crdtManager.getDocument(session.id);
      const stateUpdate = Y.encodeStateAsUpdate(doc);

      // Send current state to joining user
      socket.emit(CollaborationEvent.SYNC_STATE, {
        sessionId: session.id,
        session,
        state: Array.from(stateUpdate),
        presence: presenceManager.getSessionPresence(session.id),
        role: userRole || 'VIEWER',
      });

      // Notify others
      socket.to(session.id).emit(CollaborationEvent.USER_JOINED, {
        userId: socket.userId,
        user: {
          id: socket.userId,
          email: socket.userEmail,
          name: socket.userName,
          color: socket.userColor,
        },
        timestamp: Date.now(),
      });

      console.log(`👤 User ${socket.userName} joined session ${session.name}`);
    } catch (error) {
      console.error('Error joining session:', error);
      socket.emit(CollaborationEvent.ERROR, {
        code: 'JOIN_ERROR',
        message: 'Failed to join session',
      });
    }
  });

  // Leave session
  socket.on(CollaborationEvent.LEAVE_SESSION, async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;

      await collaborationManager.leaveSession(sessionId, socket.userId);
      presenceManager.removeUser(sessionId, socket.userId);
      socket.leave(sessionId);

      // Notify others
      socket.to(sessionId).emit(CollaborationEvent.USER_LEFT, {
        userId: socket.userId,
        userName: socket.userName,
        timestamp: Date.now(),
      });

      console.log(`👤 User ${socket.userName} left session ${sessionId}`);
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  });

  // Handle edit operations (CRDT updates)
  socket.on(CollaborationEvent.EDIT_OPERATION, async (data: { sessionId: string; update: number[] }) => {
    try {
      const { sessionId, update } = data;

      // Verify permission
      const role = await collaborationManager.getUserRole(sessionId, socket.userId);
      if (role !== 'OWNER' && role !== 'EDITOR') {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'PERMISSION_DENIED',
          message: 'You do not have edit permissions',
        });
        return;
      }

      // Apply update to CRDT
      const updateArray = new Uint8Array(update);
      await crdtManager.applyUpdate(sessionId, updateArray, socket.userId);

      // Get current text for history
      const currentText = await crdtManager.getText(sessionId);

      // Record in edit history
      await prisma.editHistory.create({
        data: {
          sessionId,
          userId: socket.userId,
          operation: JSON.stringify({
            type: 'crdt_update',
            timestamp: Date.now(),
          }),
          contentAfter: currentText.slice(0, 10000),
        },
      });

      // Broadcast to other users in the session
      socket.to(sessionId).emit(CollaborationEvent.EDIT_OPERATION, {
        sessionId,
        update,
        userId: socket.userId,
        timestamp: Date.now(),
      });

      // Update activity
      presenceManager.updateActivity(sessionId, socket.userId);
    } catch (error) {
      console.error('Error handling edit operation:', error);
      socket.emit(CollaborationEvent.ERROR, {
        code: 'EDIT_ERROR',
        message: 'Failed to apply edit',
      });
    }
  });

  // Sync request - client wants to sync with server state
  socket.on(CollaborationEvent.SYNC_REQUEST, async (data: { sessionId: string; stateVector: number[] }) => {
    try {
      const { sessionId, stateVector } = data;

      const clientStateVector = new Uint8Array(stateVector);
      const serverUpdate = await crdtManager.syncWithClient(sessionId, clientStateVector);

      socket.emit(CollaborationEvent.SYNC_STATE, {
        sessionId,
        state: Array.from(serverUpdate),
      });
    } catch (error) {
      console.error('Error handling sync request:', error);
    }
  });

  // Session update (metadata)
  socket.on(CollaborationEvent.SESSION_UPDATE, async (data: { sessionId: string; updates: Record<string, unknown> }) => {
    try {
      const { sessionId, updates } = data;

      // Verify ownership
      const role = await collaborationManager.getUserRole(sessionId, socket.userId);
      if (role !== 'OWNER') {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'PERMISSION_DENIED',
          message: 'Only the owner can update session settings',
        });
        return;
      }

      // Update session
      await prisma.collaborationSession.update({
        where: { id: sessionId },
        data: {
          name: updates.name as string | undefined,
          description: updates.description as string | undefined,
          isActive: updates.isActive as boolean | undefined,
        },
      });

      // Broadcast to all users
      io.to(sessionId).emit(CollaborationEvent.SESSION_UPDATE, {
        sessionId,
        updates,
        updatedBy: socket.userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error updating session:', error);
    }
  });

  // Permission change
  socket.on(CollaborationEvent.PERMISSION_CHANGE, async (data: {
    sessionId: string;
    targetUserId: string;
    newRole: 'EDITOR' | 'VIEWER'
  }) => {
    try {
      const { sessionId, targetUserId, newRole } = data;

      // Verify ownership
      const role = await collaborationManager.getUserRole(sessionId, socket.userId);
      if (role !== 'OWNER') {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'PERMISSION_DENIED',
          message: 'Only the owner can change permissions',
        });
        return;
      }

      // Update member role
      await prisma.sessionMember.updateMany({
        where: {
          sessionId,
          userId: targetUserId,
        },
        data: { role: newRole },
      });

      // Notify all users
      io.to(sessionId).emit(CollaborationEvent.PERMISSION_CHANGE, {
        sessionId,
        userId: targetUserId,
        newRole,
        changedBy: socket.userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error changing permission:', error);
    }
  });
}
