import { z } from 'zod';

/**
 * Ethereum address validation (0x + 40 hex chars)
 */
const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

/**
 * Driver address params schema for GET /drivers/:address/score
 */
export const driverAddressParamsSchema = z.object({
  address: ethereumAddressSchema,
});

export type DriverAddressParams = z.infer<typeof driverAddressParamsSchema>;
