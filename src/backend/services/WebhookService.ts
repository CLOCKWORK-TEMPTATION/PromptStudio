import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface WebhookEvent {
    id: string;
    type: string;
    tenantId?: string;
    data: Record<string, unknown>;
    timestamp: Date;
}

export class WebhookService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Register a new webhook
     */
    async registerWebhook(
        tenantId: string,
        name: string,
        url: string,
        events: string[],
        secret?: string
    ): Promise<string> {
        const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

        const webhook = await this.prisma.webhook.create({
            data: {
                tenantId,
                name,
                url,
                secret: webhookSecret,
                events
            }
        });

        return webhook.id;
    }

    /**
     * Update webhook configuration
     */
    async updateWebhook(
        webhookId: string,
        updates: {
            name?: string;
            url?: string;
            events?: string[];
            isActive?: boolean;
        }
    ): Promise<void> {
        await this.prisma.webhook.update({
            where: { id: webhookId },
            data: updates
        });
    }

    /**
     * Delete webhook
     */
    async deleteWebhook(webhookId: string): Promise<void> {
        await this.prisma.webhook.delete({
            where: { id: webhookId }
        });
    }

    /**
     * Get webhooks for a tenant
     */
    async getTenantWebhooks(tenantId: string): Promise<unknown[]> {
        return await this.prisma.webhook.findMany({
            where: { tenantId },
            select: {
                id: true,
                name: true,
                url: true,
                events: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            }
        });
    }

    /**
     * Trigger webhooks for an event
     */
    async triggerWebhooks(event: WebhookEvent): Promise<void> {
        try {
            // Find all active webhooks that subscribe to this event type
            const webhooks = await this.prisma.webhook.findMany({
                where: {
                    isActive: true,
                    events: {
                        has: event.type
                    },
                    ...(event.tenantId && { tenantId: event.tenantId })
                }
            });

            // Send webhook requests in parallel
            const webhookPromises = webhooks.map(webhook =>
                this.sendWebhookRequest(webhook, event)
            );

            await Promise.allSettled(webhookPromises);
        } catch (error) {
            console.error('Failed to trigger webhooks:', error);
        }
    }

    /**
     * Send individual webhook request
     */
    private async sendWebhookRequest(
        webhook: { id: string; url: string; secret: string },
        event: WebhookEvent
    ): Promise<void> {
        try {
            const payload = JSON.stringify({
                id: event.id,
                type: event.type,
                timestamp: event.timestamp.toISOString(),
                data: event.data
            });

            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(payload)
                .digest('hex');

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-ID': webhook.id,
                    'X-Event-Type': event.type,
                    'User-Agent': 'PromptStudio-Webhook/1.0'
                },
                body: payload,
                // Timeout after 10 seconds
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                console.error(`Webhook ${webhook.id} failed with status ${response.status}`);
            }
        } catch (error) {
            console.error(`Webhook ${webhook.id} delivery failed:`, error);
        }
    }

    /**
     * Verify webhook signature from external source
     */
    verifyWebhookSignature(
        payload: string,
        signature: string,
        secret: string
    ): boolean {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(payload)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            console.error('Webhook signature verification failed:', error);
            return false;
        }
    }

    /**
     * Predefined event types
     */
    static readonly EVENT_TYPES = {
        // User events
        USER_CREATED: 'user.created',
        USER_UPDATED: 'user.updated',
        USER_DELETED: 'user.deleted',

        // Session events
        SESSION_CREATED: 'session.created',
        SESSION_UPDATED: 'session.updated',
        SESSION_DELETED: 'session.deleted',

        // Prompt events
        PROMPT_PUBLISHED: 'prompt.published',
        PROMPT_UPDATED: 'prompt.updated',
        PROMPT_DELETED: 'prompt.deleted',

        // Marketplace events
        PROMPT_PURCHASED: 'marketplace.purchase',
        PROMPT_REVIEWED: 'marketplace.review',

        // System events
        SYSTEM_ALERT: 'system.alert',
        ANALYTICS_UPDATE: 'analytics.update'
    } as const;

    /**
     * Create system alert event
     */
    createSystemAlert(
        tenantId: string | undefined,
        alertType: string,
        message: string,
        severity: 'low' | 'medium' | 'high' | 'critical',
        details?: Record<string, unknown>
    ): WebhookEvent {
        return {
            id: crypto.randomUUID(),
            type: WebhookService.EVENT_TYPES.SYSTEM_ALERT,
            tenantId,
            data: {
                alertType,
                message,
                severity,
                details
            },
            timestamp: new Date()
        };
    }

    /**
     * Create analytics update event
     */
    createAnalyticsUpdate(
        tenantId: string,
        metricType: string,
        metrics: Record<string, unknown>
    ): WebhookEvent {
        return {
            id: crypto.randomUUID(),
            type: WebhookService.EVENT_TYPES.ANALYTICS_UPDATE,
            tenantId,
            data: {
                metricType,
                metrics,
                period: 'daily'
            },
            timestamp: new Date()
        };
    }
}