import prisma from '../../lib/prisma.js';
import redis from '../../lib/redis.js';
import type { CollaborationSession, SessionMember, MemberRole } from '../../../../shared/types/collaboration.js';

interface SessionState {
  sessionId: string;
  content: string;
  version: number;
  lastModified: number;
  activeUsers: Set<string>;
}

export class CollaborationManager {
  private sessions: Map<string, SessionState> = new Map();
  private readonly SESSION_LOCK_TTL = 30; // seconds

  async getSession(sessionId: string): Promise<CollaborationSession | null> {
    try {
      const session = await prisma.collaborationSession.findUnique({
        where: { id: sessionId },
        include: {
          owner: true,
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!session) return null;

      return {
        id: session.id,
        name: session.name,
        description: session.description || undefined,
        content: session.content,
        isActive: session.isActive,
        shareToken: session.shareToken,
        ownerId: session.ownerId,
        owner: {
          id: session.owner.id,
          email: session.owner.email,
          name: session.owner.name,
          avatar: session.owner.avatar || undefined,
          color: session.owner.color,
        },
        members: session.members.map(m => ({
          id: m.id,
          userId: m.userId,
          user: {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            avatar: m.user.avatar || undefined,
            color: m.user.color,
          },
          role: m.role as MemberRole,
          joinedAt: m.joinedAt.toISOString(),
          lastSeenAt: m.lastSeenAt.toISOString(),
        })),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  async getSessionByShareToken(shareToken: string): Promise<CollaborationSession | null> {
    try {
      const session = await prisma.collaborationSession.findUnique({
        where: { shareToken },
        include: {
          owner: true,
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!session) return null;

      return this.getSession(session.id);
    } catch (error) {
      console.error('Error fetching session by share token:', error);
      return null;
    }
  }

  async joinSession(sessionId: string, userId: string, role: MemberRole = 'VIEWER'): Promise<boolean> {
    try {
      // Check if already a member
      const existingMember = await prisma.sessionMember.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId,
          },
        },
      });

      if (existingMember) {
        // Update last seen
        await prisma.sessionMember.update({
          where: { id: existingMember.id },
          data: { lastSeenAt: new Date() },
        });
        return true;
      }

      // Add as new member
      await prisma.sessionMember.create({
        data: {
          userId,
          sessionId,
          role,
        },
      });

      // Initialize session state if not exists
      if (!this.sessions.has(sessionId)) {
        const session = await prisma.collaborationSession.findUnique({
          where: { id: sessionId },
        });
        if (session) {
          this.sessions.set(sessionId, {
            sessionId,
            content: session.content,
            version: 0,
            lastModified: Date.now(),
            activeUsers: new Set(),
          });
        }
      }

      const state = this.sessions.get(sessionId);
      if (state) {
        state.activeUsers.add(userId);
      }

      return true;
    } catch (error) {
      console.error('Error joining session:', error);
      return false;
    }
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.activeUsers.delete(userId);

      // Clean up if no active users
      if (state.activeUsers.size === 0) {
        // Persist content before cleanup
        await this.persistContent(sessionId);
        // Keep session in memory for a while for quick rejoin
      }
    }

    // Update last seen
    await prisma.sessionMember.updateMany({
      where: { sessionId, userId },
      data: { lastSeenAt: new Date() },
    });
  }

  async getUserRole(sessionId: string, userId: string): Promise<MemberRole | null> {
    try {
      // Check if owner
      const session = await prisma.collaborationSession.findUnique({
        where: { id: sessionId },
        select: { ownerId: true },
      });

      if (session?.ownerId === userId) {
        return 'OWNER';
      }

      // Check membership
      const member = await prisma.sessionMember.findUnique({
        where: {
          userId_sessionId: {
            userId,
            sessionId,
          },
        },
      });

      return member?.role as MemberRole || null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  async updateContent(sessionId: string, content: string, userId: string): Promise<boolean> {
    try {
      // Acquire lock
      const lockKey = `session:lock:${sessionId}`;
      const lockAcquired = await redis.set(lockKey, userId, 'EX', this.SESSION_LOCK_TTL, 'NX');

      if (!lockAcquired) {
        // Check if we own the lock
        const lockOwner = await redis.get(lockKey);
        if (lockOwner !== userId) {
          return false;
        }
      }

      try {
        const state = this.sessions.get(sessionId);
        const previousContent = state?.content || '';

        // Update in-memory state
        if (state) {
          state.content = content;
          state.version++;
          state.lastModified = Date.now();
        }

        // Store in Redis for quick access
        await redis.set(`session:content:${sessionId}`, content, 'EX', 3600);

        // Record edit history
        await prisma.editHistory.create({
          data: {
            sessionId,
            userId,
            operation: JSON.stringify({ type: 'update', timestamp: Date.now() }),
            contentBefore: previousContent.slice(0, 10000), // Limit size
            contentAfter: content.slice(0, 10000),
          },
        });

        return true;
      } finally {
        // Release lock
        await redis.del(lockKey);
      }
    } catch (error) {
      console.error('Error updating content:', error);
      return false;
    }
  }

  async persistContent(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    try {
      await prisma.collaborationSession.update({
        where: { id: sessionId },
        data: { content: state.content },
      });
    } catch (error) {
      console.error('Error persisting content:', error);
    }
  }

  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveUsers(sessionId: string): string[] {
    const state = this.sessions.get(sessionId);
    return state ? Array.from(state.activeUsers) : [];
  }

  async createSnapshot(sessionId: string, name: string): Promise<string | null> {
    try {
      const state = this.sessions.get(sessionId);
      const content = state?.content || (await prisma.collaborationSession.findUnique({
        where: { id: sessionId },
        select: { content: true },
      }))?.content || '';

      const snapshot = await prisma.sessionSnapshot.create({
        data: {
          sessionId,
          name,
          content,
        },
      });

      return snapshot.id;
    } catch (error) {
      console.error('Error creating snapshot:', error);
      return null;
    }
  }

  async restoreSnapshot(sessionId: string, snapshotId: string): Promise<boolean> {
    try {
      const snapshot = await prisma.sessionSnapshot.findUnique({
        where: { id: snapshotId },
      });

      if (!snapshot || snapshot.sessionId !== sessionId) {
        return false;
      }

      // Update session content
      await prisma.collaborationSession.update({
        where: { id: sessionId },
        data: { content: snapshot.content },
      });

      // Update in-memory state
      const state = this.sessions.get(sessionId);
      if (state) {
        state.content = snapshot.content;
        state.version++;
        state.lastModified = Date.now();
      }

      return true;
    } catch (error) {
      console.error('Error restoring snapshot:', error);
      return false;
    }
  }
}
