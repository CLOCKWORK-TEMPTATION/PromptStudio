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
  content: string;
  isActive: boolean;
  shareToken?: string;
  ownerId: string;
  owner: User;
  members: CollaborationMember[];
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationMember {
  id: string;
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

  // Sync events
  SYNC_REQUEST = 'sync_request',
  SYNC_STATE = 'sync_state',

  // Edit events
  EDIT_OPERATION = 'edit_operation',

  // User events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Cursor events
  CURSOR_MOVE = 'cursor_move',
  CURSOR_UPDATE = 'cursor_update',

  // Presence events
  PRESENCE_UPDATE = 'presence_update',

  // Permission events
  PERMISSION_CHANGE = 'permission_change',

  // Comment events
  COMMENT_ADD = 'comment_add',
  COMMENT_UPDATE = 'comment_update',
  COMMENT_DELETE = 'comment_delete',
  COMMENT_RESOLVE = 'comment_resolve',

  // Error event
  ERROR = 'collaboration_error',
}
