import { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import type { PresenceManager } from '../managers/PresenceManager.js';
import { CollaborationEvent, CursorPosition } from '../../../../shared/types/collaboration.js';

export function handlePresenceEvents(
  io: SocketIOServer,
  socket: AuthenticatedSocket,
  presenceManager: PresenceManager
): void {
  // Cursor movement
  socket.on(CollaborationEvent.CURSOR_MOVE, (data: {
    sessionId: string;
    cursor: CursorPosition
  }) => {
    const { sessionId, cursor } = data;

    // Update cursor with user info
    const cursorWithUser: CursorPosition = {
      ...cursor,
      userId: socket.userId,
      timestamp: Date.now(),
    };

    // Update presence manager
    presenceManager.updateCursor(sessionId, socket.userId, cursorWithUser);

    // Broadcast to other users (throttled on client side)
    socket.to(sessionId).emit(CollaborationEvent.CURSOR_UPDATE, {
      userId: socket.userId,
      userName: socket.userName,
      userColor: socket.userColor,
      cursor: cursorWithUser,
    });
  });

  // Presence heartbeat
  socket.on('presence_heartbeat', (data: { sessionId: string }) => {
    const { sessionId } = data;
    presenceManager.updateActivity(sessionId, socket.userId);
  });

  // Request full presence state
  socket.on('get_presence', (data: { sessionId: string }) => {
    const { sessionId } = data;
    const presence = presenceManager.getSessionPresence(sessionId);

    socket.emit(CollaborationEvent.PRESENCE_UPDATE, {
      sessionId,
      presence,
    });
  });

  // Selection change (for showing what text others have selected)
  socket.on('selection_change', (data: {
    sessionId: string;
    selection: { start: number; end: number } | null;
  }) => {
    const { sessionId, selection } = data;

    // Update cursor with selection
    const currentCursor = presenceManager.getUserPresence(sessionId, socket.userId)?.cursor;
    if (currentCursor) {
      presenceManager.updateCursor(sessionId, socket.userId, {
        ...currentCursor,
        selection: selection || undefined,
      });
    }

    // Broadcast selection to others
    socket.to(sessionId).emit('selection_update', {
      userId: socket.userId,
      userName: socket.userName,
      userColor: socket.userColor,
      selection,
    });
  });

  // User typing indicator
  socket.on('typing_start', (data: { sessionId: string }) => {
    const { sessionId } = data;

    socket.to(sessionId).emit('user_typing', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping: true,
    });
  });

  socket.on('typing_stop', (data: { sessionId: string }) => {
    const { sessionId } = data;

    socket.to(sessionId).emit('user_typing', {
      userId: socket.userId,
      userName: socket.userName,
      isTyping: false,
    });
  });

  // User focus/blur (tab visibility)
  socket.on('user_focus', (data: { sessionId: string; isFocused: boolean }) => {
    const { sessionId, isFocused } = data;

    if (isFocused) {
      presenceManager.updateActivity(sessionId, socket.userId);
    }

    socket.to(sessionId).emit('user_focus_change', {
      userId: socket.userId,
      isFocused,
    });
  });
}
