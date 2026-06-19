import { z } from 'zod';

/**
 * GPS coordinate schema
 */
const gpsPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.number().positive('Timestamp must be positive'),
  speed: z.number().min(0).optional(),
});

/**
 * Braking event schema
 */
const brakingEventSchema = z.object({
  timestamp: z.number().positive(),
  deceleration: z.number(), // m/s²
  duration: z.number().positive(),
});

/**
 * Acceleration event schema
 */
const accelerationEventSchema = z.object({
  timestamp: z.number().positive(),
  acceleration: z.number(), // m/s²
  duration: z.number().positive(),
});

/**
 * Cornering event schema (lateral g-force > 0.3g)
 */
const corneringEventSchema = z.object({
  timestamp: z.number().positive(),
  lateralG: z.number(), // g-force
  duration: z.number().positive(),
});

/**
 * Phone usage event schema
 */
const phoneEventSchema = z.object({
  startTime: z.number().positive(),
  endTime: z.number().positive(),
  type: z.enum(['screen_on', 'interaction', 'call']),
});

/**
 * Trip submission schema
 * Validates the TripRecord payload from the mobile app
 */
export const tripSubmitSchema = z.object({
  startTime: z.number().positive('Start time must be a positive timestamp'),
  endTime: z.number().positive('End time must be a positive timestamp'),
  coordinates: z
    .array(gpsPointSchema)
    .min(1, 'At least one GPS coordinate is required'),
  speedReadings: z.array(z.number().min(0)).optional().default([]),
  brakingEvents: z.array(brakingEventSchema).optional().default([]),
  accelerationEvents: z.array(accelerationEventSchema).optional().default([]),
  corneringEvents: z.array(corneringEventSchema).optional().default([]),
  phoneUsageEvents: z.array(phoneEventSchema).optional().default([]),
  distanceKm: z.number().positive('Distance must be positive'),
  category: z.enum(['commute', 'delivery', 'rideshare', 'long-distance']),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: 'End time must be after start time', path: ['endTime'] }
);

export type TripSubmitInput = z.infer<typeof tripSubmitSchema>;

/**
 * Batch trip submission schema for offline sync.
 * Accepts an array of trip records (max 50, matching local storage limit).
 */
export const tripBatchSubmitSchema = z.object({
  trips: z
    .array(tripSubmitSchema)
    .min(1, 'At least one trip is required')
    .max(50, 'Maximum 50 trips per batch submission'),
});

export type TripBatchSubmitInput = z.infer<typeof tripBatchSubmitSchema>;
