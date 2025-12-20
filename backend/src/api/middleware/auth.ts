import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

export interface AuthRequest extends Request {
  userId: string;
  userEmail: string;
  userName: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      email: string;
      name: string;
    };

    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).userEmail = decoded.email;
    (req as AuthRequest).userName = decoded.name;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        email: string;
        name: string;
      };

      (req as AuthRequest).userId = decoded.userId;
      (req as AuthRequest).userEmail = decoded.email;
      (req as AuthRequest).userName = decoded.name;
    }

    next();
  } catch {
    // Ignore invalid tokens for optional auth
    next();
  }
}
