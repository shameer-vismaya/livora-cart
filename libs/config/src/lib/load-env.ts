import { z, ZodError, ZodType } from 'zod';

/**
 * Typed environment loader. Validates `process.env` (or a provided record)
 * against a zod schema and throws a clear, aggregated error on missing/invalid
 * keys — so a misconfigured service fails fast at boot, not deep in a request.
 *
 * Usage:
 *   const Env = z.object({ DATABASE_URL: z.string().url() });
 *   const env = loadEnv(Env);
 */
export function loadEnv<T extends ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  try {
    return schema.parse(source);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    throw err;
  }
}

/** Common reusable env fragments shared across Livora services. */
export const commonEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});
