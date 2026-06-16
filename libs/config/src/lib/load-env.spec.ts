import { z } from 'zod';
import { loadEnv } from './load-env';

describe('loadEnv', () => {
  const schema = z.object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive(),
  });

  it('parses and coerces valid env', () => {
    const env = loadEnv(schema, {
      DATABASE_URL: 'postgres://localhost:5432/db',
      PORT: '3001',
    });
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toContain('postgres://');
  });

  it('throws an aggregated error on invalid env', () => {
    expect(() => loadEnv(schema, { PORT: 'nope' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
