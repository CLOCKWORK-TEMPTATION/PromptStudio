// Shared collaboration types

export enum CollaborationEvent {
  // Session events
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SYNC_STATE = 'sync_state',

  // User events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Edit events
  EDIT_OPERATION = 'edit_operation',

  // Cursor events
  CURSOR_MOVE = 'cursor_move',
  CURSOR_UPDATE = 'cursor_update',

  // Presence events
  PRESENCE_UPDATE = 'presence_update',

  // Comment events
  COMMENT_ADD = 'comment_add',
  COMMENT_UPDATE = 'comment_update',
  COMMENT_DELETE = 'comment_delete',

  // Permission events
  PERMISSION_CHANGE = 'permission_change',

  // Error events
  ERROR = 'error',
}

export interface CollaborationSession {
  id: string;
  name: string;
  shareToken?: string;
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
