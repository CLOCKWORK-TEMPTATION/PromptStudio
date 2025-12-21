// ============================================================
// Rate Limiter Middleware - Epic 3.2
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Function to generate unique key
  skipFailedRequests?: boolean;
  message?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'Too many requests, please try again later.',
};

// In-memory store for development (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Rate limiter middleware factory
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = finalConfig.keyGenerator
      ? finalConfig.keyGenerator(req)
      : getDefaultKey(req);

    const now = Date.now();
    const windowStart = now - finalConfig.windowMs;

    try {
      // Try to use database for persistent rate limiting
      await cleanupOldEntries(windowStart);

      const entry = await prisma.rateLimitEntry.findFirst({
        where: {
          identifier: key,
          endpoint: req.path,
          windowStart: { gte: new Date(windowStart) },
        },
        orderBy: { windowStart: 'desc' },
      });

      if (entry) {
        if (entry.requestCount >= finalConfig.maxRequests) {
          // Rate limit exceeded
          res.set('X-RateLimit-Limit', String(finalConfig.maxRequests));
          res.set('X-RateLimit-Remaining', '0');
          res.set('X-RateLimit-Reset', String(Math.ceil((entry.windowStart.getTime() + finalConfig.windowMs) / 1000)));

          // Log rate limit event
          await logRateLimitEvent(key, req.path);

          return res.status(429).json({
            error: finalConfig.message,
            retryAfter: Math.ceil(finalConfig.windowMs / 1000),
          });
        }

        // Increment counter
        await prisma.rateLimitEntry.update({
          where: { id: entry.id },
          data: { requestCount: entry.requestCount + 1 },
        });

        res.set('X-RateLimit-Limit', String(finalConfig.maxRequests));
        res.set('X-RateLimit-Remaining', String(finalConfig.maxRequests - entry.requestCount - 1));
      } else {
        // Create new entry
        await prisma.rateLimitEntry.create({
          data: {
            identifier: key,
            endpoint: req.path,
            windowStart: new Date(now),
            requestCount: 1,
          },
        });

        res.set('X-RateLimit-Limit', String(finalConfig.maxRequests));
        res.set('X-RateLimit-Remaining', String(finalConfig.maxRequests - 1));
      }

      next();
    } catch (error) {
      // Fallback to in-memory if database fails
      console.warn('Rate limiter falling back to in-memory store:', error);

      const memKey = `${key}:${req.path}`;
      const memEntry = rateLimitStore.get(memKey);

      if (memEntry && memEntry.resetTime > now) {
        if (memEntry.count >= finalConfig.maxRequests) {
          res.set('X-RateLimit-Limit', String(finalConfig.maxRequests));
          res.set('X-RateLimit-Remaining', '0');
          return res.status(429).json({
            error: finalConfig.message,
            retryAfter: Math.ceil((memEntry.resetTime - now) / 1000),
          });
        }
        memEntry.count++;
      } else {
        rateLimitStore.set(memKey, {
          count: 1,
          resetTime: now + finalConfig.windowMs,
        });
      }

      next();
    }
  };
}

/**
 * Get default rate limit key (user ID or IP)
 */
function getDefaultKey(req: Request): string {
  // Try to get user ID from auth
  const userId = (req as any).userId || (req as any).user?.id;
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Clean up old rate limit entries
 */
async function cleanupOldEntries(windowStart: number): Promise<void> {
  try {
    await prisma.rateLimitEntry.deleteMany({
      where: {
        windowStart: { lt: new Date(windowStart - 3600000) }, // 1 hour ago
      },
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Log rate limit event to audit
 */
async function logRateLimitEvent(identifier: string, endpoint: string): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: identifier.startsWith('user:') ? identifier.replace('user:', '') : null,
        eventType: 'RATE_LIMITED',
        entityType: 'rate_limit',
        payloadJson: { endpoint, identifier },
      },
    });
  } catch (error) {
    console.error('Failed to log rate limit event:', error);
  }
}

/**
 * Default rate limiter for sensitive endpoints
 */
export const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute for sensitive endpoints
  message: 'Rate limit exceeded. Please wait before making more requests.',
});

/**
 * Strict rate limiter for optimization/evaluation runs
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
  message: 'Too many optimization/evaluation requests. Please wait.',
});

/**
 * Lenient rate limiter for read operations
 */
export const lenientRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many requests. Please slow down.',
});
