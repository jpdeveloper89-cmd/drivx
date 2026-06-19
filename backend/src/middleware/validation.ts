import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware factory.
 * Validates request body, query, or params against a Zod schema.
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Replace with parsed (and potentially transformed) data
    if (source === 'body') {
      req.body = result.data;
    }

    next();
  };
}

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}
