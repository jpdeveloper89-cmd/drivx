import { z } from 'zod';

/**
 * Registration schema
 * Drivers register with email + phone only (crypto-invisible onboarding)
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  phone: z
    .string()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number must be at most 20 characters')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format'),
});

/**
 * Login schema
 * Drivers authenticate with email + phone only (crypto-invisible onboarding)
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  phone: z
    .string()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number must be at most 20 characters')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
