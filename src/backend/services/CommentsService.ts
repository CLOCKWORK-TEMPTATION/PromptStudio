// ============================================================
// Comments Service - Epic 5.4
// Version comments and review notes
// ============================================================

import { prisma } from '../lib/prisma.js';

// ============================================================
// Types
// ============================================================

export interface CommentPosition {
  section: 'system' | 'developer' | 'user' | 'context';
  start: number;
  end: number;
}

export interface CreateCommentInput {
  versionId: string;
  content: string;
  position?: CommentPosition;
  parentId?: string;
  workspaceId?: string;
  createdById: string;
}

export interface UpdateCommentInput {
  content?: string;
  resolved?: boolean;
  resolvedById?: string;
}

export interface CommentThread {
  id: string;
  versionId: string;
  content: string;
  position?: CommentPosition | null;
  resolved: boolean;
  resolvedAt?: Date | null;
  resolvedById?: string | null;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  replies: CommentReply[];
  replyCount: number;
}

export interface CommentReply {
  id: string;
  content: string;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Comments Service
// ============================================================

export class CommentsService {
  /**
   * Create a new comment on a version
   */
  async createComment(input: CreateCommentInput): Promise<{ id: string }> {
    const comment = await prisma.versionComment.create({
      data: {
        versionId: input.versionId,
        content: input.content,
        positionJson: input.position || null,
        parentId: input.parentId,
        workspaceId: input.workspaceId,
        createdById: input.createdById,
      },
    });

    return { id: comment.id };
  }

  /**
   * Get all comments for a version (as threads)
   */
  async getCommentsForVersion(versionId: string): Promise<CommentThread[]> {
    // Get top-level comments (no parent)
    const comments = await prisma.versionComment.findMany({
      where: {
        versionId,
        parentId: null,
      },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map(comment => ({
      id: comment.id,
      versionId: comment.versionId,
      content: comment.content,
      position: comment.positionJson as CommentPosition | null,
      resolved: comment.resolved,
      resolvedAt: comment.resolvedAt,
      resolvedById: comment.resolvedById,
      createdById: comment.createdById,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: comment.replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        createdById: reply.createdById,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      })),
      replyCount: comment.replies.length,
    }));
  }

  /**
   * Get comments for a specific position in the prompt
   */
  async getCommentsAtPosition(
    versionId: string,
    section: string,
    start: number,
    end: number
  ): Promise<CommentThread[]> {
    const comments = await prisma.versionComment.findMany({
      where: {
        versionId,
        parentId: null,
      },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Filter by position overlap
    const overlapping = comments.filter(comment => {
      const pos = comment.positionJson as CommentPosition | null;
      if (!pos) return false;
      if (pos.section !== section) return false;

      // Check for overlap
      return pos.start <= end && pos.end >= start;
    });

    return overlapping.map(comment => ({
      id: comment.id,
      versionId: comment.versionId,
      content: comment.content,
      position: comment.positionJson as CommentPosition | null,
      resolved: comment.resolved,
      resolvedAt: comment.resolvedAt,
      resolvedById: comment.resolvedById,
      createdById: comment.createdById,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: comment.replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        createdById: reply.createdById,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      })),
      replyCount: comment.replies.length,
    }));
  }

  /**
   * Get a single comment by ID
   */
  async getCommentById(commentId: string) {
    const comment = await prisma.versionComment.findUnique({
      where: { id: commentId },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!comment) return null;

    return {
      id: comment.id,
      versionId: comment.versionId,
      content: comment.content,
      position: comment.positionJson as CommentPosition | null,
      resolved: comment.resolved,
      resolvedAt: comment.resolvedAt,
      resolvedById: comment.resolvedById,
      createdById: comment.createdById,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: comment.replies.map(reply => ({
        id: reply.id,
        content: reply.content,
        createdById: reply.createdById,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      })),
      replyCount: comment.replies.length,
    };
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, input: UpdateCommentInput) {
    const data: Record<string, unknown> = {};

    if (input.content !== undefined) {
      data.content = input.content;
    }

    if (input.resolved !== undefined) {
      data.resolved = input.resolved;
      if (input.resolved) {
        data.resolvedAt = new Date();
        data.resolvedById = input.resolvedById;
      } else {
        data.resolvedAt = null;
        data.resolvedById = null;
      }
    }

    return prisma.versionComment.update({
      where: { id: commentId },
      data,
    });
  }

  /**
   * Delete a comment and its replies
   */
  async deleteComment(commentId: string): Promise<void> {
    // Delete replies first
    await prisma.versionComment.deleteMany({
      where: { parentId: commentId },
    });

    // Delete the comment
    await prisma.versionComment.delete({
      where: { id: commentId },
    });
  }

  /**
   * Reply to a comment
   */
  async replyToComment(
    parentId: string,
    content: string,
    createdById: string
  ): Promise<{ id: string }> {
    // Get parent comment to get versionId
    const parent = await prisma.versionComment.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new Error('Parent comment not found');
    }

    const reply = await prisma.versionComment.create({
      data: {
        versionId: parent.versionId,
        content,
        parentId,
        workspaceId: parent.workspaceId,
        createdById,
      },
    });

    return { id: reply.id };
  }

  /**
   * Resolve a comment thread
   */
  async resolveComment(commentId: string, resolvedById: string): Promise<void> {
    await prisma.versionComment.update({
      where: { id: commentId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedById,
      },
    });
  }

  /**
   * Unresolve a comment thread
   */
  async unresolveComment(commentId: string): Promise<void> {
    await prisma.versionComment.update({
      where: { id: commentId },
      data: {
        resolved: false,
        resolvedAt: null,
        resolvedById: null,
      },
    });
  }

  /**
   * Get unresolved comment count for a version
   */
  async getUnresolvedCount(versionId: string): Promise<number> {
    return prisma.versionComment.count({
      where: {
        versionId,
        parentId: null,
        resolved: false,
      },
    });
  }

  /**
   * Get comment statistics for a version
   */
  async getCommentStats(versionId: string) {
    const [total, resolved, unresolved] = await Promise.all([
      prisma.versionComment.count({
        where: { versionId, parentId: null },
      }),
      prisma.versionComment.count({
        where: { versionId, parentId: null, resolved: true },
      }),
      prisma.versionComment.count({
        where: { versionId, parentId: null, resolved: false },
      }),
    ]);

    return { total, resolved, unresolved };
  }

  /**
   * Get all comments by a user
   */
  async getCommentsByUser(userId: string, limit = 50) {
    const comments = await prisma.versionComment.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        parent: {
          select: { id: true, content: true },
        },
      },
    });

    return comments.map(comment => ({
      id: comment.id,
      versionId: comment.versionId,
      content: comment.content,
      isReply: !!comment.parentId,
      parentContent: comment.parent?.content,
      resolved: comment.resolved,
      createdAt: comment.createdAt,
    }));
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const commentsService = new CommentsService();
