// ============================================================
// Access Control Service - Epic 5.1
// Role-based access control and permission guards
// ============================================================

import { prisma } from '../lib/prisma.js';
import { Request, Response, NextFunction } from 'express';

// ============================================================
// Types
// ============================================================

export type ResourceType =
  | 'template'
  | 'version'
  | 'dataset'
  | 'rubric'
  | 'optimization_run'
  | 'evaluation_run'
  | 'critique_run'
  | 'technique'
  | 'share_link';

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'share' | 'execute';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface AccessContext {
  userId?: string;
  workspaceId?: string;
  tenantId?: string;
  roles?: string[];
}

// ============================================================
// Permission Matrix
// ============================================================

const PERMISSION_MATRIX: Record<string, Record<ActionType, string[]>> = {
  template: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin', 'editor'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor', 'viewer'],
  },
  version: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin', 'editor'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor', 'viewer'],
  },
  dataset: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin', 'editor'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor', 'viewer'],
  },
  rubric: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin', 'editor'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor', 'viewer'],
  },
  optimization_run: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor'],
  },
  evaluation_run: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor'],
  },
  critique_run: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor'],
  },
  technique: {
    create: ['owner', 'admin', 'editor'],
    read: ['owner', 'admin', 'editor', 'viewer'],
    update: ['owner', 'admin', 'editor'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin', 'editor', 'viewer'],
  },
  share_link: {
    create: ['owner', 'admin'],
    read: ['owner', 'admin', 'editor'],
    update: ['owner', 'admin'],
    delete: ['owner', 'admin'],
    share: ['owner', 'admin'],
    execute: ['owner', 'admin'],
  },
};

// ============================================================
// Access Control Service
// ============================================================

export class AccessControlService {
  /**
   * Check if user has permission for an action on a resource
   */
  async checkPermission(
    context: AccessContext,
    resource: ResourceType,
    action: ActionType,
    resourceId?: string
  ): Promise<PermissionCheck> {
    // No user = no access (except for public share links)
    if (!context.userId) {
      return { allowed: false, reason: 'Authentication required' };
    }

    // Get user's roles
    const roles = context.roles || await this.getUserRoles(context.userId, context.workspaceId);

    // Check permission matrix
    const allowedRoles = PERMISSION_MATRIX[resource]?.[action] || [];
    const hasRole = roles.some(role => allowedRoles.includes(role.toLowerCase()));

    if (hasRole) {
      return { allowed: true };
    }

    // Check if user is owner of the specific resource
    if (resourceId) {
      const isOwner = await this.isResourceOwner(context.userId, resource, resourceId);
      if (isOwner) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Insufficient permissions for ${action} on ${resource}`,
    };
  }

  /**
   * Get user's roles for a workspace
   */
  async getUserRoles(userId: string, workspaceId?: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          where: workspaceId ? { tenantId: workspaceId } : {},
        },
      },
    });

    return userRoles.map(ur => ur.role.name);
  }

  /**
   * Check if user is the owner of a resource
   */
  async isResourceOwner(userId: string, resource: ResourceType, resourceId: string): Promise<boolean> {
    switch (resource) {
      case 'template': {
        const template = await prisma.promptTemplate.findUnique({
          where: { id: resourceId },
          select: { ownerId: true },
        });
        return template?.ownerId === userId;
      }
      case 'dataset': {
        const dataset = await prisma.evaluationDataset.findUnique({
          where: { id: resourceId },
          select: { createdById: true },
        });
        return dataset?.createdById === userId;
      }
      case 'rubric': {
        const rubric = await prisma.judgeRubric.findUnique({
          where: { id: resourceId },
          select: { createdById: true },
        });
        return rubric?.createdById === userId;
      }
      case 'optimization_run': {
        const run = await prisma.optimizationRun.findUnique({
          where: { id: resourceId },
          select: { createdById: true },
        });
        return run?.createdById === userId;
      }
      case 'evaluation_run': {
        const run = await prisma.advancedEvaluationRun.findUnique({
          where: { id: resourceId },
          select: { createdById: true },
        });
        return run?.createdById === userId;
      }
      case 'critique_run': {
        const run = await prisma.critiqueRun.findUnique({
          where: { id: resourceId },
          select: { createdById: true },
        });
        return run?.createdById === userId;
      }
      case 'technique': {
        const technique = await prisma.technique.findUnique({
          where: { id: resourceId },
          select: { createdById: true, isBuiltIn: true },
        });
        // Built-in techniques are considered "owned" by everyone for read purposes
        return technique?.createdById === userId || technique?.isBuiltIn === true;
      }
      case 'share_link': {
        const link = await prisma.shareLink.findUnique({
          where: { id: resourceId },
          select: { createdById: true },
        });
        return link?.createdById === userId;
      }
      default:
        return false;
    }
  }

  /**
   * Get accessible resource IDs for a user
   */
  async getAccessibleResources(
    context: AccessContext,
    resource: ResourceType
  ): Promise<string[]> {
    if (!context.userId) {
      return [];
    }

    const roles = await this.getUserRoles(context.userId, context.workspaceId);
    const isAdminOrOwner = roles.some(r =>
      ['owner', 'admin'].includes(r.toLowerCase())
    );

    // Admins and owners can see all resources in their workspace
    if (isAdminOrOwner && context.workspaceId) {
      switch (resource) {
        case 'template': {
          const templates = await prisma.promptTemplate.findMany({
            where: { tenantId: context.workspaceId },
            select: { id: true },
          });
          return templates.map(t => t.id);
        }
        case 'dataset': {
          const datasets = await prisma.evaluationDataset.findMany({
            where: { tenantId: context.workspaceId },
            select: { id: true },
          });
          return datasets.map(d => d.id);
        }
        // Add other resource types as needed
      }
    }

    // For regular users, only their own resources
    switch (resource) {
      case 'template': {
        const templates = await prisma.promptTemplate.findMany({
          where: { ownerId: context.userId },
          select: { id: true },
        });
        return templates.map(t => t.id);
      }
      case 'dataset': {
        const datasets = await prisma.evaluationDataset.findMany({
          where: { createdById: context.userId },
          select: { id: true },
        });
        return datasets.map(d => d.id);
      }
      default:
        return [];
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId, roleId },
      },
      create: { userId, roleId },
      update: {},
    });
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.deleteMany({
      where: { userId, roleId },
    });
  }

  /**
   * Create a guard middleware for Express routes
   */
  guard(resource: ResourceType, action: ActionType) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const context: AccessContext = {
        userId: (req as any).userId,
        workspaceId: req.query.workspaceId as string || req.body?.workspaceId,
        tenantId: req.query.tenantId as string || req.body?.tenantId,
      };

      // Get resource ID from params if available
      const resourceId = req.params.id || req.params.templateId || req.params.datasetId;

      const check = await this.checkPermission(context, resource, action, resourceId);

      if (!check.allowed) {
        return res.status(403).json({
          error: 'Access denied',
          reason: check.reason,
        });
      }

      next();
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const accessControlService = new AccessControlService();

// ============================================================
// Guard Middleware Factory
// ============================================================

export function requirePermission(resource: ResourceType, action: ActionType) {
  return accessControlService.guard(resource, action);
}
