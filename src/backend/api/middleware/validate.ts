import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ParsedQs } from 'qs';

export const validate = (schema: AnyZodObject) => async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const validatedData = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Replace req properties with validated data (coerced types)
        if (validatedData.body) req.body = validatedData.body;
        if (validatedData.query) req.query = validatedData.query as ParsedQs;
        if (validatedData.params) req.params = validatedData.params as Record<string, string>;

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid request data',
                    details: error.errors.map((err) => ({
                        path: err.path.join('.'),
                        message: err.message,
                        code: err.code,
                    })),
                },
            });
        }
        next(error);
    }
};
