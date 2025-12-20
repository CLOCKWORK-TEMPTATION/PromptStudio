import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all sessions for current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;

    const sessions = await prisma.collaborationSession.findMany({
      where: {
        OR: [
          { ownerId: authReq.userId },
          { members: { some: { userId: authReq.userId } } },
        ],
      },
      include: {
        owner: true,
        members: {
          include: { user: true },
        },
        _count: {
          select: {
            comments: true,
            editHistory: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        name: session.name,
        description: session.description,
        isActive: session.isActive,
        shareToken: session.shareToken,
        ownerId: session.ownerId,
        owner: {
          id: session.owner.id,
          email: session.owner.email,
          name: session.owner.name,
          avatar: session.owner.avatar,
          color: session.owner.color,
        },
        memberCount: session.members.length,
        commentCount: session._count.comments,
        editCount: session._count.editHistory,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get sessions' },
    });
  }
});

// Create new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { name, description, content } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Session name is required' },
      });
      return;
    }

    const session = await prisma.collaborationSession.create({
      data: {
        name,
        description,
        content: content || '',
        ownerId: authReq.userId,
        members: {
          create: {
            userId: authReq.userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: true,
        members: {
          include: { user: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: session.id,
        name: session.name,
        description: session.description,
        content: session.content,
        isActive: session.isActive,
        shareToken: session.shareToken,
        ownerId: session.ownerId,
        owner: {
          id: session.owner.id,
          email: session.owner.email,
          name: session.owner.name,
          avatar: session.owner.avatar,
          color: session.owner.color,
        },
        members: session.members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          user: {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            avatar: m.user.avatar,
            color: m.user.color,
          },
        })),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to create session' },
    });
  }
});

// Get session by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
      include: {
        owner: true,
        members: {
          include: { user: true },
        },
        comments: {
          where: { parentId: null },
          include: {
            user: true,
            replies: {
              include: { user: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    // Check access
    const isMember = session.members.some(m => m.userId === authReq.userId);
    const isOwner = session.ownerId === authReq.userId;

    if (!isMember && !isOwner) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this session' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: session.id,
        name: session.name,
        description: session.description,
        content: session.content,
        isActive: session.isActive,
        shareToken: session.shareToken,
        ownerId: session.ownerId,
        owner: {
          id: session.owner.id,
          email: session.owner.email,
          name: session.owner.name,
          avatar: session.owner.avatar,
          color: session.owner.color,
        },
        members: session.members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          lastSeenAt: m.lastSeenAt.toISOString(),
          user: {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            avatar: m.user.avatar,
            color: m.user.color,
          },
        })),
        comments: session.comments,
        snapshots: session.snapshots,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get session' },
    });
  }
});

// Get session by share token (public)
router.get('/share/:shareToken', async (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;

    const session = await prisma.collaborationSession.findUnique({
      where: { shareToken },
      include: {
        owner: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (!session.isActive) {
      res.status(403).json({
        success: false,
        error: { code: 'SESSION_INACTIVE', message: 'This session is no longer active' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: session.id,
        name: session.name,
        description: session.description,
        isActive: session.isActive,
        owner: {
          name: session.owner.name,
          avatar: session.owner.avatar,
        },
        memberCount: session._count.members,
        createdAt: session.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get shared session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get session' },
    });
  }
});

// Update session
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Check ownership
    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (session.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Only the owner can update this session' },
      });
      return;
    }

    const updatedSession = await prisma.collaborationSession.update({
      where: { id },
      data: {
        name: name ?? session.name,
        description: description ?? session.description,
        isActive: isActive ?? session.isActive,
      },
    });

    res.json({
      success: true,
      data: updatedSession,
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to update session' },
    });
  }
});

// Delete session
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (session.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Only the owner can delete this session' },
      });
      return;
    }

    await prisma.collaborationSession.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: { message: 'Session deleted successfully' },
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to delete session' },
    });
  }
});

// Invite member
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { email, role } = req.body;

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (session.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Only the owner can invite members' },
      });
      return;
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    // Check if already a member
    const existingMember = await prisma.sessionMember.findUnique({
      where: {
        userId_sessionId: {
          userId: user.id,
          sessionId: id,
        },
      },
    });

    if (existingMember) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_MEMBER', message: 'User is already a member' },
      });
      return;
    }

    const member = await prisma.sessionMember.create({
      data: {
        userId: user.id,
        sessionId: id,
        role: role || 'VIEWER',
      },
      include: { user: true },
    });

    res.status(201).json({
      success: true,
      data: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        user: {
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
          avatar: member.user.avatar,
          color: member.user.color,
        },
      },
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to invite member' },
    });
  }
});

// Update member role
router.patch('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id, memberId } = req.params;
    const { role } = req.body;

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session || session.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Only the owner can update member roles' },
      });
      return;
    }

    const member = await prisma.sessionMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: true },
    });

    res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to update member' },
    });
  }
});

// Remove member
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id, memberId } = req.params;

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session || session.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Only the owner can remove members' },
      });
      return;
    }

    await prisma.sessionMember.delete({
      where: { id: memberId },
    });

    res.json({
      success: true,
      data: { message: 'Member removed successfully' },
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to remove member' },
    });
  }
});

// Get edit history
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { page = 1, pageSize = 50 } = req.query;

    // Verify access
    const member = await prisma.sessionMember.findUnique({
      where: {
        userId_sessionId: {
          userId: authReq.userId,
          sessionId: id,
        },
      },
    });

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!member && session?.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this session' },
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    const [history, total] = await Promise.all([
      prisma.editHistory.findMany({
        where: { sessionId: id },
        include: { user: true },
        orderBy: { timestamp: 'desc' },
        skip,
        take: Number(pageSize),
      }),
      prisma.editHistory.count({ where: { sessionId: id } }),
    ]);

    res.json({
      success: true,
      data: history,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        hasMore: skip + history.length < total,
      },
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get history' },
    });
  }
});

// Create snapshot
router.post('/:id/snapshots', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { name } = req.body;

    // Verify access (owner or editor)
    const member = await prisma.sessionMember.findUnique({
      where: {
        userId_sessionId: {
          userId: authReq.userId,
          sessionId: id,
        },
      },
    });

    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    const isOwner = session.ownerId === authReq.userId;
    const isEditor = member?.role === 'EDITOR' || member?.role === 'OWNER';

    if (!isOwner && !isEditor) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to create snapshots' },
      });
      return;
    }

    const snapshot = await prisma.sessionSnapshot.create({
      data: {
        sessionId: id,
        name: name || `Snapshot ${new Date().toISOString()}`,
        content: session.content,
      },
    });

    res.status(201).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Create snapshot error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to create snapshot' },
    });
  }
});

// Restore snapshot
router.post('/:id/snapshots/:snapshotId/restore', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id, snapshotId } = req.params;

    // Verify ownership
    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    if (!session || session.ownerId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Only the owner can restore snapshots' },
      });
      return;
    }

    const snapshot = await prisma.sessionSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || snapshot.sessionId !== id) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Snapshot not found' },
      });
      return;
    }

    // Update session content
    await prisma.collaborationSession.update({
      where: { id },
      data: { content: snapshot.content },
    });

    // Record in history
    await prisma.editHistory.create({
      data: {
        sessionId: id,
        userId: authReq.userId,
        operation: JSON.stringify({
          type: 'restore_snapshot',
          snapshotId,
          timestamp: Date.now(),
        }),
        contentAfter: snapshot.content.slice(0, 10000),
      },
    });

    res.json({
      success: true,
      data: { message: 'Snapshot restored successfully', content: snapshot.content },
    });
  } catch (error) {
    console.error('Restore snapshot error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to restore snapshot' },
    });
  }
});

export { router as sessionRouter };
