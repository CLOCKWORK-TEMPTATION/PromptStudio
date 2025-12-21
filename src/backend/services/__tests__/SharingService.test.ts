// ============================================================
// Sharing Service Tests - Epic 5.5
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharingService } from '../SharingService.js';

// Mock prisma
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    shareLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    promptTemplate: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    templateVersion: {
      create: vi.fn(),
    },
    evaluationDataset: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    datasetExample: {
      create: vi.fn(),
      count: vi.fn(),
    },
    judgeRubric: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma.js';

// ============================================================
// Test Fixtures
// ============================================================

const mockShareLink = {
  id: 'share-1',
  entityType: 'template',
  entityId: 'template-1',
  token: 'abc123token',
  permission: 'view',
  expiresAt: null,
  maxViews: null,
  viewCount: 0,
  passwordHash: null,
  isActive: true,
  revokedAt: null,
  revokedById: null,
  workspaceId: 'ws-1',
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTemplate = {
  id: 'template-1',
  name: 'Test Template',
  description: 'A test template',
  category: 'test',
  tags: ['test'],
  tenantId: 'ws-1',
  ownerId: 'user-1',
  activeVersionId: 'v-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  versions: [
    {
      id: 'v-1',
      versionNumber: 1,
      contentSnapshot: { system: 'Hello' },
      isActive: true,
      createdAt: new Date(),
    },
  ],
};

// ============================================================
// Tests
// ============================================================

describe('SharingService', () => {
  let service: SharingService;

  beforeEach(() => {
    service = new SharingService();
    vi.clearAllMocks();
  });

  describe('createShareLink', () => {
    it('should create a share link with default view permission', async () => {
      vi.mocked(prisma.shareLink.create).mockResolvedValue(mockShareLink);

      const result = await service.createShareLink({
        entityType: 'template',
        entityId: 'template-1',
        workspaceId: 'ws-1',
        createdById: 'user-1',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('url');
      expect(result.url).toContain('/share/');
    });

    it('should create a share link with expiration', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      vi.mocked(prisma.shareLink.create).mockResolvedValue({
        ...mockShareLink,
        expiresAt,
      });

      const result = await service.createShareLink({
        entityType: 'template',
        entityId: 'template-1',
        expiresAt,
      });

      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('should create a share link with password', async () => {
      vi.mocked(prisma.shareLink.create).mockResolvedValue({
        ...mockShareLink,
        passwordHash: 'hashed-password',
      });

      const result = await service.createShareLink({
        entityType: 'template',
        entityId: 'template-1',
        password: 'secret123',
      });

      expect(prisma.shareLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        })
      );
    });
  });

  describe('validateShareToken', () => {
    it('should return valid for active link without restrictions', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue(mockShareLink);

      const result = await service.validateShareToken('abc123token');

      expect(result.valid).toBe(true);
      expect(result.permission).toBe('view');
      expect(result.entityType).toBe('template');
    });

    it('should return invalid for non-existent token', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue(null);

      const result = await service.validateShareToken('nonexistent');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Share link not found');
    });

    it('should return invalid for revoked link', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        isActive: false,
      });

      const result = await service.validateShareToken('abc123token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Share link has been revoked');
    });

    it('should return invalid for expired link', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      const result = await service.validateShareToken('abc123token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Share link has expired');
    });

    it('should return invalid when max views reached', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        maxViews: 5,
        viewCount: 5,
      });

      const result = await service.validateShareToken('abc123token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Share link view limit reached');
    });

    it('should require password when passwordHash is set', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        passwordHash: 'hashed',
      });

      const result = await service.validateShareToken('abc123token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Password required');
    });

    it('should validate correct password', async () => {
      const hashedPassword = require('crypto')
        .createHash('sha256')
        .update('secret123')
        .digest('hex');

      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        passwordHash: hashedPassword,
      });

      const result = await service.validateShareToken('abc123token', 'secret123');

      expect(result.valid).toBe(true);
    });
  });

  describe('accessSharedEntity', () => {
    it('should increment view count on access', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue(mockShareLink);
      vi.mocked(prisma.shareLink.update).mockResolvedValue({
        ...mockShareLink,
        viewCount: 1,
      });
      vi.mocked(prisma.promptTemplate.findUnique).mockResolvedValue(mockTemplate);

      const result = await service.accessSharedEntity('abc123token');

      expect(prisma.shareLink.update).toHaveBeenCalledWith({
        where: { token: 'abc123token' },
        data: { viewCount: { increment: 1 } },
      });
      expect(result).toHaveProperty('entity');
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue(null);

      await expect(service.accessSharedEntity('invalid')).rejects.toThrow(
        'Share link not found'
      );
    });
  });

  describe('revokeShareLink', () => {
    it('should revoke an active share link', async () => {
      vi.mocked(prisma.shareLink.update).mockResolvedValue({
        ...mockShareLink,
        isActive: false,
        revokedAt: new Date(),
        revokedById: 'user-1',
      });

      await service.revokeShareLink('abc123token', 'user-1');

      expect(prisma.shareLink.update).toHaveBeenCalledWith({
        where: { token: 'abc123token' },
        data: expect.objectContaining({
          isActive: false,
          revokedAt: expect.any(Date),
          revokedById: 'user-1',
        }),
      });
    });
  });

  describe('getShareLinksForEntity', () => {
    it('should return all share links for an entity', async () => {
      vi.mocked(prisma.shareLink.findMany).mockResolvedValue([mockShareLink]);

      const result = await service.getShareLinksForEntity('template', 'template-1');

      expect(result).toHaveLength(1);
      expect(prisma.shareLink.findMany).toHaveBeenCalledWith({
        where: { entityType: 'template', entityId: 'template-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('duplicateSharedEntity', () => {
    it('should throw error when duplication not allowed', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        permission: 'view',
      });

      await expect(
        service.duplicateSharedEntity('abc123token', 'user-2', 'ws-2')
      ).rejects.toThrow('Duplication not allowed for this share link');
    });

    it('should duplicate template when permission is duplicate', async () => {
      vi.mocked(prisma.shareLink.findUnique).mockResolvedValue({
        ...mockShareLink,
        permission: 'duplicate',
      });
      vi.mocked(prisma.promptTemplate.findUnique).mockResolvedValue(mockTemplate);
      vi.mocked(prisma.promptTemplate.create).mockResolvedValue({
        ...mockTemplate,
        id: 'template-2',
        name: 'Test Template (Copy)',
      });
      vi.mocked(prisma.templateVersion.create).mockResolvedValue({
        id: 'v-2',
        templateId: 'template-2',
        versionNumber: 1,
        contentSnapshot: { system: 'Hello' },
        isActive: true,
        createdAt: new Date(),
        createdById: 'user-2',
      });

      const result = await service.duplicateSharedEntity(
        'abc123token',
        'user-2',
        'ws-2'
      );

      expect(result.entityType).toBe('template');
      expect(result.newEntityId).toBe('template-2');
    });
  });
});
