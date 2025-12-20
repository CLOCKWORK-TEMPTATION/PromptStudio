import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { useAuthStore } from '../store/authStore';
import { useCollaborationStore } from '../store/collaborationStore';
import { CollaborationEvent } from '@shared/types/collaboration';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = useAuthStore.getState().token;

    this.socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventListeners();

    return this.socket;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    const store = useCollaborationStore.getState();

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket');
      store.setConnected(true);
      store.setError(null);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      store.setConnected(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      store.setError('Connection failed');
      this.reconnectAttempts++;
    });

    // Collaboration events
    this.socket.on(CollaborationEvent.SYNC_STATE, (data) => {
      console.log('📥 Received sync state');
      const { session, state, presence, role } = data;

      store.setSession(session);
      store.setUserRole(role);
      store.setPresence(presence || []);

      if (state) {
        store.initDoc(new Uint8Array(state));
      }
    });

    this.socket.on(CollaborationEvent.USER_JOINED, (data) => {
      console.log('👤 User joined:', data.user?.name);
      // Update presence list
      const currentPresence = useCollaborationStore.getState().presence;
      if (data.user && !currentPresence.find(p => p.userId === data.userId)) {
        store.setPresence([
          ...currentPresence,
          {
            userId: data.userId,
            user: data.user,
            isActive: true,
            lastSeen: Date.now(),
          },
        ]);
      }
    });

    this.socket.on(CollaborationEvent.USER_LEFT, (data) => {
      console.log('👤 User left:', data.userName);
      const currentPresence = useCollaborationStore.getState().presence;
      store.setPresence(currentPresence.filter(p => p.userId !== data.userId));
      store.removeCursor(data.userId);
    });

    // Edit events
    this.socket.on(CollaborationEvent.EDIT_OPERATION, (data) => {
      const { update } = data;
      store.applyUpdate(new Uint8Array(update));
    });

    // Cursor events
    this.socket.on(CollaborationEvent.CURSOR_UPDATE, (data) => {
      const { userId, userName, userColor, cursor } = data;
      store.updateCursor({
        userId,
        userName,
        userColor,
        x: cursor.x,
        y: cursor.y,
        selection: cursor.selection,
      });
    });

    // Presence events
    this.socket.on(CollaborationEvent.PRESENCE_UPDATE, (data) => {
      store.setPresence(data.presence || []);
    });

    // Typing events
    this.socket.on('user_typing', (data) => {
      store.setTypingUser(data.userId, data.isTyping);
    });

    // Comment events
    this.socket.on(CollaborationEvent.COMMENT_ADD, (data) => {
      store.addComment(data.comment);
    });

    this.socket.on(CollaborationEvent.COMMENT_UPDATE, (data) => {
      store.updateComment(data.commentId, {
        content: data.content,
        resolved: data.resolved,
        updatedAt: data.updatedAt,
      });
    });

    this.socket.on(CollaborationEvent.COMMENT_DELETE, (data) => {
      store.removeComment(data.commentId);
    });

    this.socket.on('comments_list', (data) => {
      store.setComments(data.comments || []);
    });

    // Permission events
    this.socket.on(CollaborationEvent.PERMISSION_CHANGE, (data) => {
      const currentUser = useAuthStore.getState().user;
      if (data.userId === currentUser?.id) {
        store.setUserRole(data.newRole);
      }
    });

    // Error events
    this.socket.on(CollaborationEvent.ERROR, (data) => {
      console.error('Socket error:', data);
      store.setError(data.message);
    });
  }

  joinSession(sessionId: string, shareToken?: string): void {
    if (!this.socket?.connected) {
      this.connect();
    }

    this.socket?.emit(CollaborationEvent.JOIN_SESSION, { sessionId, shareToken });
    this.socket?.emit('get_comments', { sessionId });
  }

  leaveSession(sessionId: string): void {
    this.socket?.emit(CollaborationEvent.LEAVE_SESSION, { sessionId });
  }

  sendEdit(sessionId: string, update: Uint8Array): void {
    this.socket?.emit(CollaborationEvent.EDIT_OPERATION, {
      sessionId,
      update: Array.from(update),
    });
  }

  sendCursorMove(sessionId: string, x: number, y: number, selection?: { start: number; end: number }): void {
    this.socket?.emit(CollaborationEvent.CURSOR_MOVE, {
      sessionId,
      cursor: {
        userId: useAuthStore.getState().user?.id,
        x,
        y,
        selection,
        timestamp: Date.now(),
      },
    });
  }

  sendTypingStart(sessionId: string): void {
    this.socket?.emit('typing_start', { sessionId });
  }

  sendTypingStop(sessionId: string): void {
    this.socket?.emit('typing_stop', { sessionId });
  }

  addComment(sessionId: string, content: string, position?: { start: number; end: number }, parentId?: string): void {
    this.socket?.emit(CollaborationEvent.COMMENT_ADD, {
      sessionId,
      content,
      position,
      parentId,
    });
  }

  updateComment(sessionId: string, commentId: string, content?: string, resolved?: boolean): void {
    this.socket?.emit(CollaborationEvent.COMMENT_UPDATE, {
      sessionId,
      commentId,
      content,
      resolved,
    });
  }

  deleteComment(sessionId: string, commentId: string): void {
    this.socket?.emit(CollaborationEvent.COMMENT_DELETE, {
      sessionId,
      commentId,
    });
  }

  updatePermission(sessionId: string, userId: string, newRole: 'EDITOR' | 'VIEWER'): void {
    this.socket?.emit(CollaborationEvent.PERMISSION_CHANGE, {
      sessionId,
      targetUserId: userId,
      newRole,
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    useCollaborationStore.getState().reset();
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
