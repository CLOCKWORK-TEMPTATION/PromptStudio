// ============================================================
// Sharing API Routes - Epic 5.2
// Share links and public view endpoints
// ============================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sharingService, ShareEntityType, SharePermission } from '../../services/SharingService.js';
import { accessControlService } from '../../services/AccessControlService.js';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const createShareLinkSchema = z.object({
  entityType: z.enum(['template', 'version', 'dataset', 'rubric']),
  entityId: z.string().uuid(),
  permission: z.enum(['view', 'comment', 'duplicate']).optional(),
  expiresAt: z.string().datetime().optional(),
  maxViews: z.number().positive().optional(),
  password: z.string().min(4).optional(),
});

const updateShareLinkSchema = z.object({
  permission: z.enum(['view', 'comment', 'duplicate']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxViews: z.number().positive().nullable().optional(),
  password: z.string().min(4).nullable().optional(),
});

// ============================================================
// POST /api/share - Create a share link
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createShareLinkSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const { entityType, entityId, permission, expiresAt, maxViews, password } = validation.data;
    const userId = (req as any).userId;
    const workspaceId = req.body.workspaceId;

    // Check share permission
    const resourceType = entityType as 'template' | 'version' | 'dataset' | 'rubric';
    const permCheck = await accessControlService.checkPermission(
      { userId, workspaceId },
      resourceType,
      'share',
      entityId
    );

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Access denied',
        reason: permCheck.reason,
      });
    }

    const result = await sharingService.createShareLink({
      entityType: entityType as ShareEntityType,
      entityId,
      permission: permission as SharePermission,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      maxViews,
      password,
      workspaceId,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// ============================================================
// GET /api/share/:token - Get shared entity (public endpoint)
// ============================================================

router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.query;

    // First validate without accessing (to check if password is needed)
    const validation = await sharingService.validateShareToken(token);

    if (!validation.valid && validation.reason === 'Password required') {
      return res.status(401).json({
        error: 'Password required',
        requiresPassword: true,
      });
    }

    if (!validation.valid) {
      return res.status(404).json({ error: validation.reason });
    }

    const shared = await sharingService.accessSharedEntity(token, password as string);

    res.json({
      entityType: shared?.entityType,
      entity: shared?.entity,
      permission: shared?.permission,
      sharedAt: shared?.sharedAt,
      viewCount: shared?.viewCount,
    });
  } catch (error) {
    console.error('Error accessing shared entity:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ============================================================
// POST /api/share/:token/validate - Validate share token
// ============================================================

router.post('/:token/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const validation = await sharingService.validateShareToken(token, password);

    res.json({
      valid: validation.valid,
      reason: validation.reason,
      permission: validation.permission,
      entityType: validation.entityType,
    });
  } catch (error) {
    console.error('Error validating share token:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// ============================================================
// POST /api/share/:token/duplicate - Duplicate shared entity
// ============================================================

router.post('/:token/duplicate', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = (req as any).userId;
    const workspaceId = req.body.workspaceId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to duplicate' });
    }

    const result = await sharingService.duplicateSharedEntity(token, userId, workspaceId);

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error duplicating shared entity:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ============================================================
// GET /api/share/entity/:entityType/:entityId - Get share links for entity
// ============================================================

router.get('/entity/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = (req as any).userId;
    const workspaceId = req.query.workspaceId as string;

    // Check permission
    const permCheck = await accessControlService.checkPermission(
      { userId, workspaceId },
      entityType as 'template' | 'version' | 'dataset' | 'rubric',
      'read',
      entityId
    );

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Access denied',
        reason: permCheck.reason,
      });
    }

    const links = await sharingService.getShareLinksForEntity(
      entityType as ShareEntityType,
      entityId
    );

    res.json({
      links: links.map(link => ({
        id: link.id,
        token: link.token,
        permission: link.permission,
        expiresAt: link.expiresAt,
        maxViews: link.maxViews,
        viewCount: link.viewCount,
        isActive: link.isActive,
        hasPassword: !!link.passwordHash,
        createdAt: link.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error getting share links:', error);
    res.status(500).json({ error: 'Failed to get share links' });
  }
});

// ============================================================
// PATCH /api/share/:token - Update share link
// ============================================================

router.patch('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = (req as any).userId;

    const validation = updateShareLinkSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    // Verify ownership
    const permCheck = await accessControlService.checkPermission(
      { userId },
      'share_link',
      'update'
    );

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Access denied',
        reason: permCheck.reason,
      });
    }

    const { permission, expiresAt, maxViews, password } = validation.data;

    const updated = await sharingService.updateShareLink(token, {
      permission: permission as SharePermission | undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : expiresAt === null ? null : undefined,
      maxViews: maxViews,
      password: password,
    });

    res.json({
      success: true,
      link: {
        token: updated.token,
        permission: updated.permission,
        expiresAt: updated.expiresAt,
        maxViews: updated.maxViews,
        hasPassword: !!updated.passwordHash,
      },
    });
  } catch (error) {
    console.error('Error updating share link:', error);
    res.status(500).json({ error: 'Failed to update share link' });
  }
});

// ============================================================
// DELETE /api/share/:token - Revoke share link
// ============================================================

router.delete('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = (req as any).userId;

    // Verify ownership or admin
    const permCheck = await accessControlService.checkPermission(
      { userId },
      'share_link',
      'delete'
    );

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Access denied',
        reason: permCheck.reason,
      });
    }

    await sharingService.revokeShareLink(token, userId);

    res.json({ success: true, message: 'Share link revoked' });
  } catch (error) {
    console.error('Error revoking share link:', error);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

// ============================================================
// GET /api/share/my-links - Get user's share links
// ============================================================

router.get('/my/links', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const links = await sharingService.getShareLinksByUser(userId);

    res.json({
      links: links.map(link => ({
        id: link.id,
        token: link.token,
        entityType: link.entityType,
        entityId: link.entityId,
        permission: link.permission,
        expiresAt: link.expiresAt,
        maxViews: link.maxViews,
        viewCount: link.viewCount,
        isActive: link.isActive,
        hasPassword: !!link.passwordHash,
        createdAt: link.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error getting user share links:', error);
    res.status(500).json({ error: 'Failed to get share links' });
  }
});

export default router;
