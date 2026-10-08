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

  it('defaults mail env vars when unset', () => {
    const config = validateEnv({ ...BASE_ENV });
    expect(config.RESEND_API_KEY).toBe('');
    expect(config.MAIL_FROM).toBe('noreply@lokerkita.id');
    expect(config.APP_URL).toBe('');
  });

  it('trims whitespace from RESEND_API_KEY', () => {
    const config = validateEnv({ ...BASE_ENV, RESEND_API_KEY: '  re_abc  ' });
    expect(config.RESEND_API_KEY).toBe('re_abc');
  });

  it('rejects MAIL_FROM without @', () => {
    expect(() => validateEnv({ ...BASE_ENV, MAIL_FROM: 'not-an-email' })).toThrow(
      'MAIL_FROM must contain @',
    );
  });

  it('rejects MAIL_FROM containing CR/LF', () => {
    expect(() => validateEnv({ ...BASE_ENV, MAIL_FROM: 'a@b.com\r\nBcc: x' })).toThrow();
  });

  it('rejects a non-string MAIL_FROM', () => {
    expect(() => validateEnv({ ...BASE_ENV, MAIL_FROM: 123 })).toThrow();
  });

  it('rejects APP_URL without http(s) scheme', () => {
    expect(() => validateEnv({ ...BASE_ENV, APP_URL: 'ftp://example.com' })).toThrow(
      'APP_URL must be a valid URL',
    );
  });

  it('rejects APP_URL with credentials or query string', () => {
    expect(() =>
      validateEnv({ ...BASE_ENV, APP_URL: 'https://user:pass@example.com/?x=1' }),
    ).toThrow('APP_URL must not contain credentials');
  });

  it('rejects APP_URL with a query string and no credentials', () => {
    expect(() => validateEnv({ ...BASE_ENV, APP_URL: 'https://example.com/?x=1' })).toThrow();
  });

  it('rejects APP_URL with a fragment', () => {
    expect(() => validateEnv({ ...BASE_ENV, APP_URL: 'https://example.com/#frag' })).toThrow();
  });

  it('accepts a valid APP_URL and strips trailing slashes', () => {
    const config = validateEnv({ ...BASE_ENV, APP_URL: 'https://app.lokerkita.id/' });
    expect(config.APP_URL).toBe('https://app.lokerkita.id');
  });
});
