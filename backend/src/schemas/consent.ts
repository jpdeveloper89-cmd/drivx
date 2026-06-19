import { z } from 'zod';

/**
 * Maximum consent duration: 12 months in seconds (365 days).
 * Requirements: 14.3
 */
const MAX_DURATION_SECONDS = 365 * 24 * 3600;

/**
 * Schema for granting consent to an authorized party.
 * Categories is a bitmask: 0x01=Score, 0x02=Trips, 0x04=Delivery, 0x08=Insurance
 */
export const grantConsentSchema = z.object({
  party: z
    .string()
    .min(1, 'Party identifier is required')
    .max(255, 'Party identifier must be at most 255 characters'),
  categories: z
    .number()
    .int('Categories must be an integer')
    .min(1, 'Categories must be at least 1')
    .max(15, 'Categories must be at most 15 (0x0F bitmask)'),
  durationSeconds: z
    .number()
    .int('Duration must be an integer number of seconds')
    .positive('Duration must be positive')
    .max(MAX_DURATION_SECONDS, 'Duration cannot exceed 12 months'),
});

export type GrantConsentInput = z.infer<typeof grantConsentSchema>;
