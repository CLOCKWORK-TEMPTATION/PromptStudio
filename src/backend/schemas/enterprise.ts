import { z } from 'zod';
import { UUIDSchema, PaginationSchema } from './common.js';

// --- Multi-Tenancy ---

export const CreateTenantSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        domain: z.string().optional(),
        config: z.record(z.unknown()).optional(),
    }),
});

export const UpdateTenantSchema = z.object({
    params: z.object({
        id: UUIDSchema,
    }),
    body: z.object({
        name: z.string().min(2).optional(),
        domain: z.string().optional(),
        isActive: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
    }),
});

// --- RBAC ---

export const CreateRoleSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        tenantId: UUIDSchema.optional(),
        permissions: z.array(z.string()).optional(), // Array of Permission IDs
    }),
});

export const AssignRoleSchema = z.object({
    body: z.object({
        userId: UUIDSchema,
        roleId: UUIDSchema,
    }),
});

// --- Audit Logs ---

export const AuditLogQuerySchema = z.object({
    query: PaginationSchema.extend({
        userId: UUIDSchema.optional(),
        action: z.string().optional(),
        resource: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),
});

// --- Webhooks ---

export const CreateWebhookSchema = z.object({
    body: z.object({
        name: z.string().min(2),
        url: z.string().url(),
        events: z.array(z.string()).min(1),
        isActive: z.boolean().optional().default(true),
    }),
});

// --- Operational Metrics ---

export const MetricsQuerySchema = z.object({
    query: z.object({
        metricType: z.enum(['usage', 'cost', 'quality', 'reliability']),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        interval: z.enum(['hour', 'day', 'week']).default('day'),
    }),
});
