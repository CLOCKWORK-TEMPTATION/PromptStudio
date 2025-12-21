// ============================================================
// Comments Service Tests - Epic 5.5
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentsService, CommentPosition } from '../CommentsService.js';

// Mock prisma
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    versionComment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma.js';

// ============================================================
// Test Fixtures
// ============================================================

const mockComment = {
  id: 'comment-1',
  versionId: 'version-1',
  content: 'This is a test comment',
  positionJson: { section: 'system', start: 0, end: 10 },
  parentId: null,
  resolved: false,
  resolvedAt: null,
  resolvedById: null,
  workspaceId: 'ws-1',
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  replies: [],
};

const mockReply = {
  id: 'reply-1',
  versionId: 'version-1',
  content: 'This is a reply',
  positionJson: null,
  parentId: 'comment-1',
  resolved: false,
  resolvedAt: null,
  resolvedById: null,
  workspaceId: 'ws-1',
  createdById: 'user-2',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================
// Tests
// ============================================================

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(() => {
    service = new CommentsService();
    vi.clearAllMocks();
  });

  describe('createComment', () => {
    it('should create a new comment', async () => {
      vi.mocked(prisma.versionComment.create).mockResolvedValue(mockComment);

      const result = await service.createComment({
        versionId: 'version-1',
        content: 'This is a test comment',
        createdById: 'user-1',
      });

      expect(result.id).toBe('comment-1');
      expect(prisma.versionComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          versionId: 'version-1',
          content: 'This is a test comment',
          createdById: 'user-1',
        }),
      });
    });

    it('should create a comment with position', async () => {
      const position: CommentPosition = {
        section: 'system',
        start: 0,
        end: 10,
      };

      vi.mocked(prisma.versionComment.create).mockResolvedValue({
        ...mockComment,
        positionJson: position,
      });

      await service.createComment({
        versionId: 'version-1',
        content: 'Inline comment',
        position,
        createdById: 'user-1',
      });

      expect(prisma.versionComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          positionJson: position,
        }),
      });
    });
  });

  describe('getCommentsForVersion', () => {
    it('should return comments with replies', async () => {
      vi.mocked(prisma.versionComment.findMany).mockResolvedValue([
        {
          ...mockComment,
          replies: [mockReply],
        },
      ]);

      const result = await service.getCommentsForVersion('version-1');

      expect(result).toHaveLength(1);
      expect(result[0].replies).toHaveLength(1);
      expect(result[0].replyCount).toBe(1);
    });

    it('should only return top-level comments', async () => {
      vi.mocked(prisma.versionComment.findMany).mockResolvedValue([mockComment]);

      await service.getCommentsForVersion('version-1');

      expect(prisma.versionComment.findMany).toHaveBeenCalledWith({
        where: {
          versionId: 'version-1',
          parentId: null,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getCommentsAtPosition', () => {
    it('should return comments overlapping with position', async () => {
      const comment1 = {
        ...mockComment,
        positionJson: { section: 'system', start: 0, end: 20 },
        replies: [],
      };
      const comment2 = {
        ...mockComment,
        id: 'comment-2',
        positionJson: { section: 'system', start: 50, end: 60 },
        replies: [],
      };

      vi.mocked(prisma.versionComment.findMany).mockResolvedValue([
        comment1,
        comment2,
      ]);

      const result = await service.getCommentsAtPosition(
        'version-1',
        'system',
        5,
        15
      );

      // Should only return comment1 (overlaps with 5-15)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('comment-1');
    });

    it('should return empty for non-overlapping position', async () => {
      vi.mocked(prisma.versionComment.findMany).mockResolvedValue([
        {
          ...mockComment,
          positionJson: { section: 'developer', start: 0, end: 10 },
          replies: [],
        },
      ]);

      const result = await service.getCommentsAtPosition(
        'version-1',
        'system',
        0,
        10
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('replyToComment', () => {
    it('should create a reply to a comment', async () => {
      vi.mocked(prisma.versionComment.findUnique).mockResolvedValue(mockComment);
      vi.mocked(prisma.versionComment.create).mockResolvedValue(mockReply);

      const result = await service.replyToComment(
        'comment-1',
        'This is a reply',
        'user-2'
      );

      expect(result.id).toBe('reply-1');
      expect(prisma.versionComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: 'comment-1',
          content: 'This is a reply',
        }),
      });
    });

    it('should throw error if parent not found', async () => {
      vi.mocked(prisma.versionComment.findUnique).mockResolvedValue(null);

      await expect(
        service.replyToComment('nonexistent', 'Reply', 'user-1')
      ).rejects.toThrow('Parent comment not found');
    });
  });

  describe('resolveComment', () => {
    it('should resolve a comment', async () => {
      vi.mocked(prisma.versionComment.update).mockResolvedValue({
        ...mockComment,
        resolved: true,
        resolvedAt: new Date(),
        resolvedById: 'user-1',
      });

      await service.resolveComment('comment-1', 'user-1');

      expect(prisma.versionComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: expect.objectContaining({
          resolved: true,
          resolvedById: 'user-1',
        }),
      });
    });
  });

  describe('unresolveComment', () => {
    it('should unresolve a comment', async () => {
      vi.mocked(prisma.versionComment.update).mockResolvedValue({
        ...mockComment,
        resolved: false,
        resolvedAt: null,
        resolvedById: null,
      });

      await service.unresolveComment('comment-1');

      expect(prisma.versionComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: {
          resolved: false,
          resolvedAt: null,
          resolvedById: null,
        },
      });
    });
  });

  describe('deleteComment', () => {
    it('should delete comment and its replies', async () => {
      vi.mocked(prisma.versionComment.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.versionComment.delete).mockResolvedValue(mockComment);

      await service.deleteComment('comment-1');

      expect(prisma.versionComment.deleteMany).toHaveBeenCalledWith({
        where: { parentId: 'comment-1' },
      });
      expect(prisma.versionComment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
    });
  });

  describe('getCommentStats', () => {
    it('should return correct statistics', async () => {
      vi.mocked(prisma.versionComment.count)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7)  // resolved
        .mockResolvedValueOnce(3); // unresolved

      const stats = await service.getCommentStats('version-1');

      expect(stats.total).toBe(10);
      expect(stats.resolved).toBe(7);
      expect(stats.unresolved).toBe(3);
    });
  });

  describe('updateComment', () => {
    it('should update comment content', async () => {
      vi.mocked(prisma.versionComment.update).mockResolvedValue({
        ...mockComment,
        content: 'Updated content',
      });

      const result = await service.updateComment('comment-1', {
        content: 'Updated content',
      });

      expect(prisma.versionComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'Updated content' },
      });
    });

    it('should update resolved status with timestamp', async () => {
      vi.mocked(prisma.versionComment.update).mockResolvedValue({
        ...mockComment,
        resolved: true,
        resolvedAt: new Date(),
        resolvedById: 'user-1',
      });

      await service.updateComment('comment-1', {
        resolved: true,
        resolvedById: 'user-1',
      });

      expect(prisma.versionComment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: expect.objectContaining({
          resolved: true,
          resolvedAt: expect.any(Date),
          resolvedById: 'user-1',
        }),
      });
    });
  });
});
