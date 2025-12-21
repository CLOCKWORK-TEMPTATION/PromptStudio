// ============================================================
// Comments API Routes - Epic 5.4
// Version comments and review notes
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { commentsService } from '../../services/CommentsService.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const createCommentSchema = z.object({
  versionId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  position: z.object({
    section: z.enum(['system', 'developer', 'user', 'context']),
    start: z.number().min(0),
    end: z.number().min(0),
  }).optional(),
  parentId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

const replySchema = z.object({
  content: z.string().min(1).max(5000),
});

// ============================================================
// GET /api/comments/version/:versionId - Get all comments for a version
// ============================================================

router.get('/version/:versionId', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;

    const comments = await commentsService.getCommentsForVersion(versionId);
    const stats = await commentsService.getCommentStats(versionId);

    res.json({
      comments,
      stats,
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// ============================================================
// GET /api/comments/version/:versionId/position - Get comments at position
// ============================================================

router.get('/version/:versionId/position', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    const { section, start, end } = req.query;

    if (!section || start === undefined || end === undefined) {
      return res.status(400).json({
        error: 'section, start, and end query params are required',
      });
    }

    const comments = await commentsService.getCommentsAtPosition(
      versionId,
      section as string,
      parseInt(start as string, 10),
      parseInt(end as string, 10)
    );

    res.json({ comments });
  } catch (error) {
    console.error('Error getting comments at position:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// ============================================================
// GET /api/comments/:id - Get a single comment
// ============================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const comment = await commentsService.getCommentById(id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ comment });
  } catch (error) {
    console.error('Error getting comment:', error);
    res.status(500).json({ error: 'Failed to get comment' });
  }
});

// ============================================================
// POST /api/comments - Create a new comment
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await commentsService.createComment({
      ...validation.data,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      commentId: result.id,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// ============================================================
// POST /api/comments/:id/reply - Reply to a comment
// ============================================================

router.post('/:id/reply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = replySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await commentsService.replyToComment(
      id,
      validation.data.content,
      userId
    );

    res.status(201).json({
      success: true,
      replyId: result.id,
    });
  } catch (error) {
    console.error('Error creating reply:', error);
    if ((error as Error).message === 'Parent comment not found') {
      return res.status(404).json({ error: 'Parent comment not found' });
    }
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

// ============================================================
// PATCH /api/comments/:id - Update a comment
// ============================================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const userId = (req as any).userId;

    const comment = await commentsService.updateComment(id, {
      ...validation.data,
      resolvedById: validation.data.resolved ? userId : undefined,
    });

    res.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        resolved: comment.resolved,
        resolvedAt: comment.resolvedAt,
      },
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// ============================================================
// POST /api/comments/:id/resolve - Resolve a comment
// ============================================================

router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await commentsService.resolveComment(id, userId);

    res.json({ success: true, message: 'Comment resolved' });
  } catch (error) {
    console.error('Error resolving comment:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

// ============================================================
// POST /api/comments/:id/unresolve - Unresolve a comment
// ============================================================

router.post('/:id/unresolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await commentsService.unresolveComment(id);

    res.json({ success: true, message: 'Comment unresolved' });
  } catch (error) {
    console.error('Error unresolving comment:', error);
    res.status(500).json({ error: 'Failed to unresolve comment' });
  }
});

// ============================================================
// DELETE /api/comments/:id - Delete a comment
// ============================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await commentsService.deleteComment(id);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============================================================
// GET /api/comments/my - Get current user's comments
// ============================================================

router.get('/my/activity', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { limit = '50' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const comments = await commentsService.getCommentsByUser(
      userId,
      parseInt(limit as string, 10)
    );

    res.json({ comments });
  } catch (error) {
    console.error('Error getting user comments:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

export default router;
