import { z } from 'zod';

export const LoginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().optional(),
    }),
});

export const RegisterSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        name: z.string().min(2, 'Name must be at least 2 characters'),
        password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    }),
});

export const UpdateProfileSchema = z.object({
    body: z.object({
        name: z.string().min(2).optional(),
        avatar: z.string().url().optional(),
        color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    }),
});
