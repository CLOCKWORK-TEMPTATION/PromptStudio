import { PrismaClient } from '@prisma/client';

declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };

export interface Permission {
    resource: string;
    action: string;
}

export interface RBACContext {
    userId: string;
    tenantId?: string;
}

export class RBACService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Check if user has permission for a specific action on a resource
     */
    async hasPermission(context: RBACContext, permission: Permission): Promise<boolean> {
        try {
            // Get user roles
            const userRoles = await this.prisma.userRole.findMany({
                where: { userId: context.userId },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            });

            // Check if any role has the required permission
            for (const userRole of userRoles) {
                // Check tenant scope if role is tenant-specific
                if (userRole.role.tenantId && userRole.role.tenantId !== context.tenantId) {
                    continue;
                }

                const hasPermission = userRole.role.permissions.some(
                    (rp: { permission: { resource: string; action: string } }) => rp.permission.resource === permission.resource &&
                        rp.permission.action === permission.action
                );

                if (hasPermission) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('RBAC permission check failed:', error);
            return false;
        }
    }

    /**
     * Check if user has any of the specified permissions
     */
    async hasAnyPermission(context: RBACContext, permissions: Permission[]): Promise<boolean> {
        for (const permission of permissions) {
            if (await this.hasPermission(context, permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if user has all of the specified permissions
     */
    async hasAllPermissions(context: RBACContext, permissions: Permission[]): Promise<boolean> {
        for (const permission of permissions) {
            if (!(await this.hasPermission(context, permission))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get all permissions for a user
     */
    async getUserPermissions(context: RBACContext): Promise<Permission[]> {
        try {
            const userRoles = await this.prisma.userRole.findMany({
                where: { userId: context.userId },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            });

            const permissions: Permission[] = [];

            for (const userRole of userRoles) {
                // Check tenant scope
                if (userRole.role.tenantId && userRole.role.tenantId !== context.tenantId) {
                    continue;
                }

                for (const rolePermission of userRole.role.permissions) {
                    const perm = {
                        resource: rolePermission.permission.resource,
                        action: rolePermission.permission.action
                    };

                    // Avoid duplicates
                    if (!permissions.some(p => p.resource === perm.resource && p.action === perm.action)) {
                        permissions.push(perm);
                    }
                }
            }

            return permissions;
        } catch (error) {
            console.error('Failed to get user permissions:', error);
            return [];
        }
    }

    /**
     * Assign role to user
     */
    async assignRole(userId: string, roleId: string): Promise<void> {
        try {
            await this.prisma.userRole.create({
                data: {
                    userId,
                    roleId
                }
            });
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') {
                // Unique constraint violation - role already assigned
                return;
            }
            throw error;
        }
    }

    /**
     * Remove role from user
     */
    async removeRole(userId: string, roleId: string): Promise<void> {
        await this.prisma.userRole.deleteMany({
            where: {
                userId,
                roleId
            }
        });
    }

    /**
     * Create a new role
     */
    async createRole(name: string, description?: string, tenantId?: string): Promise<string> {
        const role = await this.prisma.role.create({
            data: {
                name,
                description,
                tenantId,
                isSystem: false
            }
        });
        return role.id;
    }

    /**
     * Add permission to role
     */
    async addPermissionToRole(roleId: string, permission: Permission): Promise<void> {
        // Find or create permission
        let permissionRecord = await this.prisma.permission.findUnique({
            where: {
                resource_action: {
                    resource: permission.resource,
                    action: permission.action
                }
            }
        });

        if (!permissionRecord) {
            permissionRecord = await this.prisma.permission.create({
                data: {
                    name: `${permission.resource}:${permission.action}`,
                    resource: permission.resource,
                    action: permission.action,
                    isSystem: false
                }
            });
        }

        // Link permission to role
        await this.prisma.rolePermission.create({
            data: {
                roleId,
                permissionId: permissionRecord.id
            }
        });
    }

    /**
     * Initialize default roles and permissions
     */
    async initializeDefaultRoles(): Promise<void> {
        // System permissions
        const systemPermissions = [
            // User management
            { resource: 'users', action: 'read' },
            { resource: 'users', action: 'create' },
            { resource: 'users', action: 'update' },
            { resource: 'users', action: 'delete' },

            // Session management
            { resource: 'sessions', action: 'read' },
            { resource: 'sessions', action: 'create' },
            { resource: 'sessions', action: 'update' },
            { resource: 'sessions', action: 'delete' },

            // Marketplace
            { resource: 'marketplace', action: 'read' },
            { resource: 'marketplace', action: 'publish' },
            { resource: 'marketplace', action: 'moderate' },

            // Admin
            { resource: 'admin', action: 'manage' },
            { resource: 'analytics', action: 'read' },
            { resource: 'audit', action: 'read' }
        ];

        // Create permissions
        for (const perm of systemPermissions) {
            await this.prisma.permission.upsert({
                where: {
                    resource_action: {
                        resource: perm.resource,
                        action: perm.action
                    }
                },
                update: {},
                create: {
                    name: `${perm.resource}:${perm.action}`,
                    resource: perm.resource,
                    action: perm.action,
                    isSystem: true
                }
            });
        }

        // Create default roles
        const adminRoleId = await this.createRole('Admin', 'Full system access', undefined);
        const editorRoleId = await this.createRole('Editor', 'Can edit and publish content', undefined);
        const viewerRoleId = await this.createRole('Viewer', 'Read-only access', undefined);

        // Assign permissions to roles
        const adminPermissions = systemPermissions;
        const editorPermissions = systemPermissions.filter(p =>
            !p.resource.includes('admin') && !p.action.includes('delete')
        );
        const viewerPermissions = systemPermissions.filter(p =>
            p.action === 'read' && !p.resource.includes('admin')
        );

        for (const perm of adminPermissions) {
            await this.addPermissionToRole(adminRoleId, perm);
        }

        for (const perm of editorPermissions) {
            await this.addPermissionToRole(editorRoleId, perm);
        }

        for (const perm of viewerPermissions) {
            await this.addPermissionToRole(viewerRoleId, perm);
        }
    }

    /**
     * Get user roles
     */
    async getUserRoles(userId: string, tenantId?: string): Promise<{ id: string; name: string; description?: string | null; tenantId?: string | null; isSystem: boolean; isActive: boolean; createdAt: Date; updatedAt: Date }[]> {
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: true
            }
        });

        return userRoles
            .filter((ur: { role: { tenantId?: string | null } }) => !ur.role.tenantId || ur.role.tenantId === tenantId)
            .map((ur: { role: { id: string; name: string; description?: string | null; tenantId?: string | null; isSystem: boolean; isActive: boolean; createdAt: Date; updatedAt: Date } }) => ur.role);
    }
}