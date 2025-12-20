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
