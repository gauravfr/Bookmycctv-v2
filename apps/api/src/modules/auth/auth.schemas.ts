import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9._-]+$/);
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'must contain a lowercase letter')
  .regex(/[A-Z]/, 'must contain an uppercase letter')
  .regex(/[0-9]/, 'must contain a number')
  .regex(/[^A-Za-z0-9]/, 'must contain a symbol');
export const loginSchema = z
  .object({ username: usernameSchema, password: z.string().min(1).max(128) })
  .strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(500) }).strict();
export const logoutSchema = z
  .object({ refreshToken: z.string().min(20).max(500), pushTokenId: z.string().optional() })
  .strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
  .strict();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
