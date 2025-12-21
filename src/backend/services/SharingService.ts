// ============================================================
// Sharing Service - Epic 5.2
// Share tokens and public view functionality
// ============================================================

import { prisma } from '../lib/prisma.js';
import { randomBytes, createHash } from 'crypto';

// ============================================================
// Types
// ============================================================

export type ShareEntityType = 'template' | 'version' | 'dataset' | 'rubric';
export type SharePermission = 'view' | 'comment' | 'duplicate';

export interface CreateShareLinkInput {
  entityType: ShareEntityType;
  entityId: string;
  permission?: SharePermission;
  expiresAt?: Date;
  maxViews?: number;
  password?: string;
  workspaceId?: string;
  createdById?: string;
}

export interface ShareLinkValidation {
  valid: boolean;
  reason?: string;
  permission?: SharePermission;
  entityType?: ShareEntityType;
  entityId?: string;
}

export interface SharedEntity {
  entityType: ShareEntityType;
  entity: Record<string, unknown>;
  permission: SharePermission;
  sharedAt: Date;
  viewCount: number;
}

// ============================================================
// Sharing Service
// ============================================================

export class SharingService {
  /**
   * Create a new share link
   */
  async createShareLink(input: CreateShareLinkInput): Promise<{
    token: string;
    url: string;
    expiresAt?: Date;
  }> {
    // Generate secure token
    const token = this.generateSecureToken();

    // Hash password if provided
    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = this.hashPassword(input.password);
    }

    // Create the share link
    const link = await prisma.shareLink.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        token,
        permission: input.permission || 'view',
        expiresAt: input.expiresAt,
        maxViews: input.maxViews,
        passwordHash,
        workspaceId: input.workspaceId,
        createdById: input.createdById,
      },
    });

    // Build the public URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = `${baseUrl}/share/${token}`;

    return {
      token: link.token,
      url,
      expiresAt: link.expiresAt || undefined,
    };
  }

  /**
   * Validate a share token
   */
  async validateShareToken(token: string, password?: string): Promise<ShareLinkValidation> {
    const link = await prisma.shareLink.findUnique({
      where: { token },
    });

    if (!link) {
      return { valid: false, reason: 'Share link not found' };
    }

    if (!link.isActive) {
      return { valid: false, reason: 'Share link has been revoked' };
    }

    // Check expiration
    if (link.expiresAt && new Date() > link.expiresAt) {
      return { valid: false, reason: 'Share link has expired' };
    }

    // Check max views
    if (link.maxViews && link.viewCount >= link.maxViews) {
      return { valid: false, reason: 'Share link view limit reached' };
    }

    // Check password
    if (link.passwordHash) {
      if (!password) {
        return { valid: false, reason: 'Password required' };
      }
      const hash = this.hashPassword(password);
      if (hash !== link.passwordHash) {
        return { valid: false, reason: 'Invalid password' };
      }
    }

    return {
      valid: true,
      permission: link.permission as SharePermission,
      entityType: link.entityType as ShareEntityType,
      entityId: link.entityId,
    };
  }

  /**
   * Access a shared entity via token
   */
  async accessSharedEntity(
    token: string,
    password?: string
  ): Promise<SharedEntity | null> {
    const validation = await this.validateShareToken(token, password);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // Increment view count
    await prisma.shareLink.update({
      where: { token },
      data: { viewCount: { increment: 1 } },
    });

    // Get the shared entity
    const entity = await this.getEntity(
      validation.entityType!,
      validation.entityId!
    );

    if (!entity) {
      throw new Error('Shared entity not found');
    }

    const link = await prisma.shareLink.findUnique({
      where: { token },
    });

    return {
      entityType: validation.entityType!,
      entity,
      permission: validation.permission!,
      sharedAt: link!.createdAt,
      viewCount: link!.viewCount + 1,
    };
  }

  /**
   * Get entity by type and ID
   */
  private async getEntity(
    entityType: ShareEntityType,
    entityId: string
  ): Promise<Record<string, unknown> | null> {
    switch (entityType) {
      case 'template': {
        const template = await prisma.promptTemplate.findUnique({
          where: { id: entityId },
          include: {
            versions: {
              where: { isActive: true },
              take: 1,
            },
          },
        });
        if (!template) return null;
        return {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          tags: template.tags,
          activeVersion: template.versions[0] ? {
            id: template.versions[0].id,
            versionNumber: template.versions[0].versionNumber,
            content: template.versions[0].contentSnapshot,
          } : null,
          createdAt: template.createdAt,
        };
      }

      case 'version': {
        const version = await prisma.templateVersion.findUnique({
          where: { id: entityId },
          include: {
            template: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        });
        if (!version) return null;
        return {
          id: version.id,
          versionNumber: version.versionNumber,
          content: version.contentSnapshot,
          templateId: version.templateId,
          templateName: version.template.name,
          createdAt: version.createdAt,
        };
      }

      case 'dataset': {
        const dataset = await prisma.evaluationDataset.findUnique({
          where: { id: entityId },
          include: {
            examples: {
              take: 10, // Limit for public view
            },
          },
        });
        if (!dataset) return null;
        return {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          taskType: dataset.taskType,
          format: dataset.format,
          exampleCount: await prisma.datasetExample.count({
            where: { datasetId: entityId },
          }),
          sampleExamples: dataset.examples,
          createdAt: dataset.createdAt,
        };
      }

      case 'rubric': {
        const rubric = await prisma.judgeRubric.findUnique({
          where: { id: entityId },
        });
        if (!rubric) return null;
        return {
          id: rubric.id,
          name: rubric.name,
          description: rubric.description,
          rubric: rubric.rubricJson,
          modelConfig: rubric.modelConfig,
          createdAt: rubric.createdAt,
        };
      }

      default:
        return null;
    }
  }

  /**
   * Revoke a share link
   */
  async revokeShareLink(token: string, revokedById?: string): Promise<void> {
    await prisma.shareLink.update({
      where: { token },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedById,
      },
    });
  }

  /**
   * Get all share links for an entity
   */
  async getShareLinksForEntity(
    entityType: ShareEntityType,
    entityId: string
  ) {
    return prisma.shareLink.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all share links created by a user
   */
  async getShareLinksByUser(userId: string) {
    return prisma.shareLink.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update share link settings
   */
  async updateShareLink(
    token: string,
    updates: {
      permission?: SharePermission;
      expiresAt?: Date | null;
      maxViews?: number | null;
      password?: string | null;
    }
  ) {
    const data: Record<string, unknown> = {};

    if (updates.permission !== undefined) {
      data.permission = updates.permission;
    }
    if (updates.expiresAt !== undefined) {
      data.expiresAt = updates.expiresAt;
    }
    if (updates.maxViews !== undefined) {
      data.maxViews = updates.maxViews;
    }
    if (updates.password !== undefined) {
      data.passwordHash = updates.password ? this.hashPassword(updates.password) : null;
    }

    return prisma.shareLink.update({
      where: { token },
      data,
    });
  }

  /**
   * Duplicate a shared entity (if permission allows)
   */
  async duplicateSharedEntity(
    token: string,
    userId: string,
    workspaceId?: string
  ): Promise<{ entityType: ShareEntityType; newEntityId: string }> {
    const validation = await this.validateShareToken(token);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    if (validation.permission !== 'duplicate') {
      throw new Error('Duplication not allowed for this share link');
    }

    // Duplicate based on entity type
    switch (validation.entityType) {
      case 'template': {
        const original = await prisma.promptTemplate.findUnique({
          where: { id: validation.entityId },
          include: {
            versions: {
              where: { isActive: true },
              take: 1,
            },
          },
        });

        if (!original) {
          throw new Error('Template not found');
        }

        const newTemplate = await prisma.promptTemplate.create({
          data: {
            name: `${original.name} (Copy)`,
            description: original.description,
            category: original.category,
            tags: original.tags,
            tenantId: workspaceId,
            ownerId: userId,
          },
        });

        // Copy active version
        if (original.versions[0]) {
          await prisma.templateVersion.create({
            data: {
              templateId: newTemplate.id,
              versionNumber: 1,
              contentSnapshot: original.versions[0].contentSnapshot,
              createdById: userId,
              isActive: true,
            },
          });
        }

        return { entityType: 'template', newEntityId: newTemplate.id };
      }

      case 'dataset': {
        const original = await prisma.evaluationDataset.findUnique({
          where: { id: validation.entityId },
          include: { examples: true },
        });

        if (!original) {
          throw new Error('Dataset not found');
        }

        const newDataset = await prisma.evaluationDataset.create({
          data: {
            name: `${original.name} (Copy)`,
            description: original.description,
            taskType: original.taskType,
            format: original.format,
            tenantId: workspaceId,
            createdById: userId,
          },
        });

        // Copy examples
        for (const example of original.examples) {
          await prisma.datasetExample.create({
            data: {
              datasetId: newDataset.id,
              inputVariables: example.inputVariables,
              expectedOutput: example.expectedOutput,
              metadata: example.metadata,
            },
          });
        }

        return { entityType: 'dataset', newEntityId: newDataset.id };
      }

      case 'rubric': {
        const original = await prisma.judgeRubric.findUnique({
          where: { id: validation.entityId },
        });

        if (!original) {
          throw new Error('Rubric not found');
        }

        const newRubric = await prisma.judgeRubric.create({
          data: {
            name: `${original.name} (Copy)`,
            description: original.description,
            rubricJson: original.rubricJson,
            modelConfig: original.modelConfig,
            workspaceId,
            createdById: userId,
          },
        });

        return { entityType: 'rubric', newEntityId: newRubric.id };
      }

      default:
        throw new Error('Duplication not supported for this entity type');
    }
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private generateSecureToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const sharingService = new SharingService();
