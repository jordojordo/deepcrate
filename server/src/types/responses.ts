import { z } from 'zod';

/**
 * Paginated response schema factory
 */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items:  z.array(itemSchema),
    total:  z.number().int().nonnegative(),
    limit:  z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  });
}

export type PaginatedResponse<T> = {
  items:  T[];
  total:  number;
  limit:  number;
  offset: number;
};

/**
 * Action response schema
 */
export const actionResponseSchema = z.object({
  success: z.boolean(),
  count:   z.number().int().nonnegative(),
  message: z.string(),
});

export type ActionResponse = z.infer<typeof actionResponseSchema>;

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error:   z.boolean().default(true),
  code:    z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Health check response schema
 */
export const healthResponseSchema = z.object({
  status:  z.string(),
  version: z.string(),
  service: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Auth info response schema (public - no secrets)
 */
export const authInfoResponseSchema = z.object({
  enabled: z.boolean(),
  type:    z.enum(['basic', 'api_key', 'proxy', 'disabled']),
});

export type AuthInfoResponse = z.infer<typeof authInfoResponseSchema>;

/**
 * Auth current user response schema
 */
export const authMeResponseSchema = z.object({ username: z.string() });

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
