import type { UserPresence, CursorPosition, User } from '../../../../shared/types/collaboration.js';

interface PresenceState {
  userId: string;
  user: User;
  cursor?: CursorPosition;
  isActive: boolean;
  lastSeen: number;
  socketId: string;
}

export class PresenceManager {
  // sessionId -> userId -> PresenceState
  private sessions: Map<string, Map<string, PresenceState>> = new Map();
  // userId -> Set<sessionId>
  private userSessions: Map<string, Set<string>> = new Map();

  private readonly PRESENCE_TIMEOUT = 30000; // 30 seconds

  addUser(sessionId: string, user: User, socketId: string): void {
    // Initialize session presence map if needed
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }

    const sessionPresence = this.sessions.get(sessionId)!;

    sessionPresence.set(user.id, {
      userId: user.id,
      user,
      isActive: true,
      lastSeen: Date.now(),
      socketId,
    });

    // Track user's sessions
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set());
    }
    this.userSessions.get(user.id)!.add(sessionId);
  }

  removeUser(sessionId: string, userId: string): void {
    const sessionPresence = this.sessions.get(sessionId);
    if (sessionPresence) {
      sessionPresence.delete(userId);

      // Clean up empty sessions
      if (sessionPresence.size === 0) {
        this.sessions.delete(sessionId);
      }
    }

    // Update user sessions tracking
    const userSessions = this.userSessions.get(userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }

  updateCursor(sessionId: string, userId: string, cursor: CursorPosition): void {
    const sessionPresence = this.sessions.get(sessionId);
    if (!sessionPresence) return;

    const presence = sessionPresence.get(userId);
    if (presence) {
      presence.cursor = cursor;
      presence.lastSeen = Date.now();
      presence.isActive = true;
    }
  }

  updateActivity(sessionId: string, userId: string): void {
    const sessionPresence = this.sessions.get(sessionId);
    if (!sessionPresence) return;

    const presence = sessionPresence.get(userId);
    if (presence) {
      presence.lastSeen = Date.now();
      presence.isActive = true;
    }
  }

  getSessionPresence(sessionId: string): UserPresence[] {
    const sessionPresence = this.sessions.get(sessionId);
    if (!sessionPresence) return [];

    const now = Date.now();
    const presenceList: UserPresence[] = [];

    sessionPresence.forEach((state, userId) => {
      // Mark as inactive if no activity for PRESENCE_TIMEOUT
      const isActive = (now - state.lastSeen) < this.PRESENCE_TIMEOUT;

      presenceList.push({
        userId: state.userId,
        user: state.user,
        cursor: state.cursor,
        isActive,
        lastSeen: state.lastSeen,
      });
    });

    return presenceList;
  }

  getUserPresence(sessionId: string, userId: string): UserPresence | null {
    const sessionPresence = this.sessions.get(sessionId);
    if (!sessionPresence) return null;

    const state = sessionPresence.get(userId);
    if (!state) return null;

    const now = Date.now();
    return {
      userId: state.userId,
      user: state.user,
      cursor: state.cursor,
      isActive: (now - state.lastSeen) < this.PRESENCE_TIMEOUT,
      lastSeen: state.lastSeen,
    };
  }

  getUserSessions(userId: string): string[] {
    const sessions = this.userSessions.get(userId);
    return sessions ? Array.from(sessions) : [];
  }

  getActiveUserCount(sessionId: string): number {
    const sessionPresence = this.sessions.get(sessionId);
    if (!sessionPresence) return 0;

    const now = Date.now();
    let count = 0;

    sessionPresence.forEach(state => {
      if ((now - state.lastSeen) < this.PRESENCE_TIMEOUT) {
        count++;
      }
    });

    return count;
  }

  getCursors(sessionId: string): Map<string, CursorPosition> {
    const sessionPresence = this.sessions.get(sessionId);
    if (!sessionPresence) return new Map();

    const cursors = new Map<string, CursorPosition>();
    const now = Date.now();

    sessionPresence.forEach((state, userId) => {
      // Only include active users' cursors
      if (state.cursor && (now - state.lastSeen) < this.PRESENCE_TIMEOUT) {
        cursors.set(userId, state.cursor);
      }
    });

    return cursors;
  }

  // Cleanup inactive users
  cleanup(): void {
    const now = Date.now();
    const inactiveThreshold = this.PRESENCE_TIMEOUT * 2;

    this.sessions.forEach((sessionPresence, sessionId) => {
      sessionPresence.forEach((state, userId) => {
        if ((now - state.lastSeen) > inactiveThreshold) {
          this.removeUser(sessionId, userId);
        }
      });
    });
  }
}

// Run cleanup periodically
setInterval(() => {
  // This will be called on the singleton instance
}, 60000);
