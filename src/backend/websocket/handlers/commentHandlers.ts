import { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import { collaborationManager } from '../index.js';
import prisma from '../../lib/prisma.js';
import { CollaborationEvent } from '../../../../shared/types/collaboration.js';

interface CommentPayload {
  sessionId: string;
  content: string;
  position?: { start: number; end: number };
  parentId?: string;
}

interface CommentUpdatePayload {
  sessionId: string;
  commentId: string;
  content?: string;
  resolved?: boolean;
}

export function handleCommentEvents(
  io: SocketIOServer,
  socket: AuthenticatedSocket
): void {
  // Add comment
  socket.on(CollaborationEvent.COMMENT_ADD, async (data: CommentPayload) => {
    try {
      const { sessionId, content, position, parentId } = data;

      // Verify user has access
      const role = await collaborationManager.getUserRole(sessionId, socket.userId);
      if (!role) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this session',
        });
        return;
      }

      // Create comment
      const comment = await prisma.comment.create({
        data: {
          sessionId,
          userId: socket.userId,
          content,
          position: position ? position : undefined,
          parentId,
        },
        include: {
          user: true,
          replies: {
            include: {
              user: true,
            },
          },
        },
      });

      const formattedComment = {
        id: comment.id,
        content: comment.content,
        position: comment.position as { start: number; end: number } | undefined,
        resolved: comment.resolved,
        userId: comment.userId,
        user: {
          id: comment.user.id,
          email: comment.user.email,
          name: comment.user.name,
          avatar: comment.user.avatar,
          color: comment.user.color,
        },
        sessionId: comment.sessionId,
        parentId: comment.parentId,
        replies: [],
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      };

      // Broadcast to all users in session
      io.to(sessionId).emit(CollaborationEvent.COMMENT_ADD, {
        comment: formattedComment,
        addedBy: socket.userId,
      });

      console.log(`💬 Comment added by ${socket.userName} in session ${sessionId}`);
    } catch (error) {
      console.error('Error adding comment:', error);
      socket.emit(CollaborationEvent.ERROR, {
        code: 'COMMENT_ERROR',
        message: 'Failed to add comment',
      });
    }
  });

  // Update comment
  socket.on(CollaborationEvent.COMMENT_UPDATE, async (data: CommentUpdatePayload) => {
    try {
      const { sessionId, commentId, content, resolved } = data;

      // Get comment and verify ownership or session ownership
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { session: true },
      });

      if (!comment || comment.sessionId !== sessionId) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });
        return;
      }

      // Check permissions - comment owner or session owner can update
      const role = await collaborationManager.getUserRole(sessionId, socket.userId);
      const isCommentOwner = comment.userId === socket.userId;
      const isSessionOwner = role === 'OWNER';

      // Only comment owner can edit content
      if (content !== undefined && !isCommentOwner) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'PERMISSION_DENIED',
          message: 'Only the comment author can edit',
        });
        return;
      }

      // Only session owner or comment owner can resolve
      if (resolved !== undefined && !isCommentOwner && !isSessionOwner) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'PERMISSION_DENIED',
          message: 'You cannot resolve this comment',
        });
        return;
      }

      // Update comment
      const updatedComment = await prisma.comment.update({
        where: { id: commentId },
        data: {
          content: content ?? comment.content,
          resolved: resolved ?? comment.resolved,
        },
        include: {
          user: true,
        },
      });

      // Broadcast update
      io.to(sessionId).emit(CollaborationEvent.COMMENT_UPDATE, {
        commentId,
        content: updatedComment.content,
        resolved: updatedComment.resolved,
        updatedAt: updatedComment.updatedAt.toISOString(),
        updatedBy: socket.userId,
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      socket.emit(CollaborationEvent.ERROR, {
        code: 'COMMENT_ERROR',
        message: 'Failed to update comment',
      });
    }
  });

  // Delete comment
  socket.on(CollaborationEvent.COMMENT_DELETE, async (data: { sessionId: string; commentId: string }) => {
    try {
      const { sessionId, commentId } = data;

      // Get comment
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.sessionId !== sessionId) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });
        return;
      }

      // Check permissions - only comment owner or session owner can delete
      const role = await collaborationManager.getUserRole(sessionId, socket.userId);
      const isCommentOwner = comment.userId === socket.userId;
      const isSessionOwner = role === 'OWNER';

      if (!isCommentOwner && !isSessionOwner) {
        socket.emit(CollaborationEvent.ERROR, {
          code: 'PERMISSION_DENIED',
          message: 'You cannot delete this comment',
        });
        return;
      }

      // Delete comment and its replies
      await prisma.comment.deleteMany({
        where: {
          OR: [
            { id: commentId },
            { parentId: commentId },
          ],
        },
      });

      // Broadcast deletion
      io.to(sessionId).emit(CollaborationEvent.COMMENT_DELETE, {
        commentId,
        deletedBy: socket.userId,
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      socket.emit(CollaborationEvent.ERROR, {
        code: 'COMMENT_ERROR',
        message: 'Failed to delete comment',
      });
    }
  });

  // Resolve/unresolve comment (shorthand)
  socket.on(CollaborationEvent.COMMENT_RESOLVE, async (data: {
    sessionId: string;
    commentId: string;
    resolved: boolean
  }) => {
    try {
      const { sessionId, commentId, resolved } = data;

      // Reuse update logic
      socket.emit(CollaborationEvent.COMMENT_UPDATE, {
        sessionId,
        commentId,
        resolved,
      });
    } catch (error) {
      console.error('Error resolving comment:', error);
    }
  });

  // Get all comments for a session
  socket.on('get_comments', async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;

      const comments = await prisma.comment.findMany({
        where: {
          sessionId,
          parentId: null, // Only top-level comments
        },
        include: {
          user: true,
          replies: {
            include: {
              user: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const formattedComments = comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        position: comment.position as { start: number; end: number } | undefined,
        resolved: comment.resolved,
        userId: comment.userId,
        user: {
          id: comment.user.id,
          email: comment.user.email,
          name: comment.user.name,
          avatar: comment.user.avatar,
          color: comment.user.color,
        },
        sessionId: comment.sessionId,
        parentId: comment.parentId,
        replies: comment.replies.map(reply => ({
          id: reply.id,
          content: reply.content,
          resolved: reply.resolved,
          userId: reply.userId,
          user: {
            id: reply.user.id,
            email: reply.user.email,
            name: reply.user.name,
            avatar: reply.user.avatar,
            color: reply.user.color,
          },
          sessionId: reply.sessionId,
          parentId: reply.parentId,
          createdAt: reply.createdAt.toISOString(),
          updatedAt: reply.updatedAt.toISOString(),
        })),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      }));

      socket.emit('comments_list', {
        sessionId,
        comments: formattedComments,
      });
    } catch (error) {
      console.error('Error getting comments:', error);
    }
  });
}
