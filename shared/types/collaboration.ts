// Shared collaboration types

export type MemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  color: string;
}

export interface CollaborationSession {
  id: string;
  name: string;
  description?: string;
  content?: string;
  isActive?: boolean;
  shareToken?: string | null;
  ownerId?: string;
  owner?: User;
  members?: CollaborationMember[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CollaborationMember {
  id: string;
  sessionId?: string;
  userId: string;
  user: User;
  role: MemberRole;
  joinedAt: string;
  lastSeenAt: string;
}

export interface CursorPosition {
  userId: string;
  line: number;
  column: number;
  timestamp?: number;
  selection?: { start: number; end: number };
}

export interface UserPresence {
  userId: string;
  user: User;
  cursor?: CursorPosition;
  isActive: boolean;
  lastSeen: number;
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
  SYNC_STATE = 'sync_state',

  // User events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Edit events
  EDIT_OPERATION = 'edit_operation',

  // Sync events
  SYNC_REQUEST = 'sync_request',

  // Permission events
  PERMISSION_CHANGE = 'permission_change',

  // Presence events
  CURSOR_MOVE = 'cursor_move',
  CURSOR_UPDATE = 'cursor_update',
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
