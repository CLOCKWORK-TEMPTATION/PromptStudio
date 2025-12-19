// API Types for PromptStudio

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  token: string;
  expiresAt: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// Session API types
export interface CreateSessionRequest {
  name: string;
  description?: string;
  content?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  description?: string;
  content?: string;
  isActive?: boolean;
}

export interface InviteMemberRequest {
  email: string;
  role: 'EDITOR' | 'VIEWER';
}

export interface UpdateMemberRoleRequest {
  role: 'EDITOR' | 'VIEWER';
}

// Comment API types
export interface CreateCommentRequest {
  content: string;
  position?: {
    start: number;
    end: number;
  };
  parentId?: string;
}

export interface UpdateCommentRequest {
  content?: string;
  resolved?: boolean;
}

// Snapshot API types
export interface CreateSnapshotRequest {
  name: string;
}

// WebSocket authentication
export interface WebSocketAuthPayload {
  token: string;
  sessionId: string;
}
