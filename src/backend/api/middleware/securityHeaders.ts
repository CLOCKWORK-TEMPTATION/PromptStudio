// ============================================================
// Security Headers Middleware - Epic 5.5
// HTTP security headers and request validation
// ============================================================

import { Request, Response, NextFunction } from 'express';

// ============================================================
// Types
// ============================================================

export interface SecurityOptions {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableNoSniff?: boolean;
  enableXSSFilter?: boolean;
  enableFrameOptions?: boolean;
  maxRequestBodySize?: number;
  maxUrlLength?: number;
}

// ============================================================
// Security Headers Middleware
// ============================================================

export function securityHeaders(options: SecurityOptions = {}) {
  const {
    enableCSP = true,
    enableHSTS = true,
    enableNoSniff = true,
    enableXSSFilter = true,
    enableFrameOptions = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    if (enableCSP) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"
      );
    }

    // HTTP Strict Transport Security
    if (enableHSTS && process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Prevent MIME type sniffing
    if (enableNoSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // XSS Protection
    if (enableXSSFilter) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Frame Options
    if (enableFrameOptions) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // Additional security headers
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  };
}

// ============================================================
// Input Sanitization Middleware
// ============================================================

export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize common XSS patterns in body
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query as Record<string, unknown>);
    }

    next();
  };
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === 'string') {
      // Basic XSS prevention - remove script tags
      obj[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          sanitizeObject(item as Record<string, unknown>);
        }
      }
    }
  }
}

// ============================================================
// Request Validation Middleware
// ============================================================

export function validateRequest(options: SecurityOptions = {}) {
  const {
    maxRequestBodySize = 10 * 1024 * 1024, // 10MB
    maxUrlLength = 2048,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check URL length
    if (req.url.length > maxUrlLength) {
      return res.status(414).json({
        error: 'URI Too Long',
        maxLength: maxUrlLength,
      });
    }

    // Check content length
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxRequestBodySize) {
      return res.status(413).json({
        error: 'Payload Too Large',
        maxSize: maxRequestBodySize,
      });
    }

    // Validate content type for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      if (contentType && !isValidContentType(contentType)) {
        return res.status(415).json({
          error: 'Unsupported Media Type',
          supportedTypes: ['application/json', 'multipart/form-data'],
        });
      }
    }

    next();
  };
}

function isValidContentType(contentType: string): boolean {
  const validTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ];

  return validTypes.some(type => contentType.toLowerCase().includes(type));
}

// ============================================================
// SQL Injection Prevention (for raw queries)
// ============================================================

export function escapeSqlLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export function validateUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================================
// Export Combined Middleware
// ============================================================

export function securityMiddleware(options: SecurityOptions = {}) {
  const headers = securityHeaders(options);
  const sanitize = sanitizeInput();
  const validate = validateRequest(options);

  return (req: Request, res: Response, next: NextFunction) => {
    headers(req, res, (err) => {
      if (err) return next(err);
      sanitize(req, res, (err) => {
        if (err) return next(err);
        validate(req, res, next);
      });
    });
  };
}
