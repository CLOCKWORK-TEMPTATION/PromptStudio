// Shared collaboration types

export interface CollaborationSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationMember {
  id: string;
  sessionId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
}

export interface CursorPosition {
  userId: string;
  line: number;
  column: number;
}

export interface PresenceInfo {
  userId: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  lastSeen: Date;
}

// Collaboration events enum
export enum CollaborationEvent {
  // Session events
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SESSION_UPDATE = 'session_update',

  // User events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Edit events
  EDIT_OPERATION = 'edit_operation',

  // Sync events
  SYNC_REQUEST = 'sync_request',
  SYNC_STATE = 'sync_state',

  // Permission events
  PERMISSION_CHANGE = 'permission_change',

  // Presence events
  CURSOR_MOVE = 'cursor_move',
  SELECTION_CHANGE = 'selection_change',
  PRESENCE_UPDATE = 'presence_update',

  // Comment events
  COMMENT_ADD = 'comment_add',
  COMMENT_UPDATE = 'comment_update',
  COMMENT_DELETE = 'comment_delete',
  COMMENT_REPLY = 'comment_reply',
  COMMENT_RESOLVE = 'comment_resolve',

  // Error events
  ERROR = 'error',
}
