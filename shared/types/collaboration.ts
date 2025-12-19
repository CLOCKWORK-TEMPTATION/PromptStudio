// Collaboration Types for PromptStudio

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  color: string;
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  selection?: {
    start: number;
    end: number;
  };
  timestamp: number;
}

export interface UserPresence {
  userId: string;
  user: User;
  cursor?: CursorPosition;
  isActive: boolean;
  lastSeen: number;
}

export type MemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface SessionMember {
  id: string;
  userId: string;
  user: User;
  role: MemberRole;
  joinedAt: string;
  lastSeenAt: string;
}

export interface CollaborationSession {
  id: string;
  name: string;
  description?: string;
  content: string;
  isActive: boolean;
  shareToken: string;
  ownerId: string;
  owner: User;
  members: SessionMember[];
  createdAt: string;
  updatedAt: string;
}

export interface EditOperation {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
}

export interface EditHistory {
  id: string;
  operation: EditOperation;
  contentBefore?: string;
  contentAfter?: string;
  userId: string;
  user: User;
  timestamp: string;
}

export interface SessionSnapshot {
  id: string;
  name: string;
  content: string;
  sessionId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  position?: {
    start: number;
    end: number;
  };
  resolved: boolean;
  userId: string;
  user: User;
  sessionId: string;
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

// WebSocket Events
export enum CollaborationEvent {
  // Connection events
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Presence events
  CURSOR_MOVE = 'cursor_move',
  CURSOR_UPDATE = 'cursor_update',
  PRESENCE_UPDATE = 'presence_update',

  // Edit events
  EDIT_OPERATION = 'edit_operation',
  SYNC_STATE = 'sync_state',
  SYNC_REQUEST = 'sync_request',

  // Comment events
  COMMENT_ADD = 'comment_add',
  COMMENT_UPDATE = 'comment_update',
  COMMENT_DELETE = 'comment_delete',
  COMMENT_RESOLVE = 'comment_resolve',

  // Session events
  SESSION_UPDATE = 'session_update',
  PERMISSION_CHANGE = 'permission_change',

  // Error events
  ERROR = 'error',
}

export interface JoinSessionPayload {
  sessionId: string;
  userId: string;
  shareToken?: string;
}

export interface CursorMovePayload {
  sessionId: string;
  cursor: CursorPosition;
}

export interface EditOperationPayload {
  sessionId: string;
  operation: EditOperation;
  vectorClock: Record<string, number>;
}

export interface CommentPayload {
  sessionId: string;
  comment: Partial<Comment>;
}

export interface SessionUpdatePayload {
  sessionId: string;
  updates: Partial<CollaborationSession>;
}

export interface PermissionChangePayload {
  sessionId: string;
  userId: string;
  newRole: MemberRole;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

// CRDT Types
export interface CRDTOperation {
  id: string;
  type: 'insert' | 'delete';
  position: CRDTPosition;
  content?: string;
  userId: string;
  timestamp: number;
  lamportClock: number;
}

export interface CRDTPosition {
  base: string[];
  offset: number;
}

export interface CRDTDocument {
  id: string;
  operations: CRDTOperation[];
  content: string;
  vectorClock: Record<string, number>;
}
