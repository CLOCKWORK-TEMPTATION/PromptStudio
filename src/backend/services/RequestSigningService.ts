import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface SignedRequest {
    signature: string;
    timestamp: Date;
    expiresAt: Date;
}

export class RequestSigningService {
    constructor(
        private prisma: PrismaClient,
        private secretKey: string
    ) { }

    /**
     * Generate a signature for a request
     */
    generateSignature(
        userId: string | undefined,
        tenantId: string | undefined,
        payload: string,
        expiresIn: number = 300000 // 5 minutes in milliseconds
    ): SignedRequest {
        const timestamp = new Date();
        const expiresAt = new Date(timestamp.getTime() + expiresIn);

        const dataToSign = `${userId || ''}:${tenantId || ''}:${payload}:${timestamp.getTime()}:${expiresAt.getTime()}`;

        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(dataToSign)
            .digest('hex');

        return {
            signature,
            timestamp,
            expiresAt
        };
    }

    /**
     * Verify a request signature
     */
    async verifySignature(
        userId: string | undefined,
        tenantId: string | undefined,
        payload: string,
        signature: string,
        timestamp: Date,
        expiresAt: Date
    ): Promise<boolean> {
        try {
            // Check if signature is expired
            if (new Date() > expiresAt) {
                return false;
            }

            // Check if signature has been used (replay attack prevention)
            const existingSignature = await this.prisma.requestSignature.findFirst({
                where: { signature }
            });

            if (existingSignature && existingSignature.usedAt) {
                return false; // Signature already used
            }

            // Verify signature
            const dataToSign = `${userId || ''}:${tenantId || ''}:${payload}:${timestamp.getTime()}:${expiresAt.getTime()}`;

            const expectedSignature = crypto
                .createHmac('sha256', this.secretKey)
                .update(dataToSign)
                .digest('hex');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );

            if (isValid) {
                // Mark signature as used
                const existingRecord = await this.prisma.requestSignature.findFirst({
                    where: { signature }
                });
                
                if (existingRecord) {
                    await this.prisma.requestSignature.update({
                        where: { id: existingRecord.id },
                        data: {
                            usedAt: new Date(),
                            isValid: true
                        }
                    });
                } else {
                    await this.prisma.requestSignature.create({
                        data: {
                            userId,
                            tenantId,
                            signature,
                            timestamp,
                            expiresAt,
                            usedAt: new Date(),
                            isValid: true
                        }
                    });
                }
            } else {
                // Log invalid signature attempt
                await this.prisma.requestSignature.create({
                    data: {
                        userId,
                        tenantId,
                        signature,
                        timestamp,
                        expiresAt,
                        isValid: false
                    }
                });
            }

            return isValid;
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }

    /**
     * Create a signed request for API calls
     */
    createSignedRequest(
        userId: string | undefined,
        tenantId: string | undefined,
        method: string,
        url: string,
        body?: string,
        expiresIn: number = 300000
    ): SignedRequest & { headers: Record<string, string> } {
        const payload = `${method}:${url}:${body || ''}`;
        const signedRequest = this.generateSignature(userId, tenantId, payload, expiresIn);

        return {
            ...signedRequest,
            headers: {
                'X-Signature': signedRequest.signature,
                'X-Timestamp': signedRequest.timestamp.getTime().toString(),
                'X-Expires': signedRequest.expiresAt.getTime().toString(),
                'X-User-ID': userId || '',
                'X-Tenant-ID': tenantId || ''
            }
        };
    }

    /**
     * Verify signed request from headers
     */
    async verifySignedRequest(
        method: string,
        url: string,
        body: string | undefined,
        headers: Record<string, string>
    ): Promise<{ isValid: boolean; userId?: string; tenantId?: string }> {
        const signature = headers['x-signature'];
        const timestampStr = headers['x-timestamp'];
        const expiresStr = headers['x-expires'];
        const userId = headers['x-user-id'] || undefined;
        const tenantId = headers['x-tenant-id'] || undefined;

        if (!signature || !timestampStr || !expiresStr) {
            return { isValid: false };
        }

        const timestamp = new Date(parseInt(timestampStr));
        const expiresAt = new Date(parseInt(expiresStr));
        const payload = `${method}:${url}:${body || ''}`;

        const isValid = await this.verifySignature(
            userId,
            tenantId,
            payload,
            signature,
            timestamp,
            expiresAt
        );

        return {
            isValid,
            userId,
            tenantId
        };
    }

    /**
     * Clean up expired signatures
     */
    async cleanupExpiredSignatures(): Promise<number> {
        const result = await this.prisma.requestSignature.deleteMany({
            where: {
                expiresAt: { lt: new Date() }
            }
        });

        return result.count;
    }

    /**
     * Get signature statistics
     */
    async getSignatureStats(days: number = 7): Promise<{
        totalSignatures: number;
        validSignatures: number;
        invalidSignatures: number;
        expiredSignatures: number;
    }> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [total, valid, invalid, expired] = await Promise.all([
            this.prisma.requestSignature.count({
                where: { timestamp: { gte: startDate } }
            }),
            this.prisma.requestSignature.count({
                where: { timestamp: { gte: startDate }, isValid: true }
            }),
            this.prisma.requestSignature.count({
                where: { timestamp: { gte: startDate }, isValid: false }
            }),
            this.prisma.requestSignature.count({
                where: {
                    timestamp: { gte: startDate },
                    expiresAt: { lt: new Date() }
                }
            })
        ]);

        return {
            totalSignatures: total,
            validSignatures: valid,
            invalidSignatures: invalid,
            expiredSignatures: expired
        };
    }
}