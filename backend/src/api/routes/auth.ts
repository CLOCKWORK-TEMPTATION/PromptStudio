import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Generate random color for user
function generateColor(): string {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and name are required' },
      });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
      });
      return;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        color: generateColor(),
      },
    });

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        color: user.color,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          color: user.color,
        },
        token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_ERROR', message: 'Failed to register user' },
    });
  }
});

// Login (simplified - in production use proper password hashing)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        color: user.color,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          color: user.color,
        },
        token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: 'Failed to login' },
    });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;

    const user = await prisma.user.findUnique({
      where: { id: authReq.userId },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to get user' },
    });
  }
});

// Update profile
router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { name, avatar, color } = req.body;

    const user = await prisma.user.update({
      where: { id: authReq.userId },
      data: {
        name: name || undefined,
        avatar: avatar || undefined,
        color: color || undefined,
      },
    });

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to update profile' },
    });
  }
});

// Guest login (for quick access)
router.post('/guest', async (req: Request, res: Response) => {
  try {
    const guestId = uuidv4();
    const guestName = `Guest_${guestId.slice(0, 6)}`;

    // Create guest user
    const user = await prisma.user.create({
      data: {
        email: `${guestId}@guest.promptstudio`,
        name: guestName,
        color: generateColor(),
      },
    });

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        color: user.color,
      },
      config.jwt.secret,
      { expiresIn: '24h' } // Shorter expiry for guests
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          color: user.color,
        },
        token,
        expiresAt,
        isGuest: true,
      },
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: 'Failed to create guest account' },
    });
  }
});

export { router as authRouter };
