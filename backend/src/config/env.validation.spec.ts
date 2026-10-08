import { validateEnv } from './env.validation';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'short-secret-ok-in-dev',
};

describe('validateEnv', () => {
  it('fails when a required variable is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: 'x' })).toThrow(
      'Missing required environment variables: DATABASE_URL',
    );
  });

  it('rejects a short JWT secret in production', () => {
    expect(() => validateEnv({ ...BASE_ENV, NODE_ENV: 'production' })).toThrow(
      'JWT_SECRET must be at least 32 characters long',
    );
  });

  it('accepts a long JWT secret in production', () => {
    const config = validateEnv({
      ...BASE_ENV,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
    });
    expect(config.JWT_SECRET).toHaveLength(32);
    expect(config.NODE_ENV).toBe('production');
  });

  it('allows a short JWT secret outside production', () => {
    const config = validateEnv({ ...BASE_ENV });
    expect(config.NODE_ENV).toBe('development');
    expect(config.JWT_EXPIRES_IN_SECONDS).toBe(86_400);
    expect(config.PORT).toBe(3000);
  });

  it('rejects an unknown NODE_ENV instead of silently skipping prod rules', () => {
    expect(() => validateEnv({ ...BASE_ENV, NODE_ENV: 'prod' })).toThrow(
      'NODE_ENV must be one of development, test, production',
    );
  });
});
