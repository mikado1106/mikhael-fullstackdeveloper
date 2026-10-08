export interface EnvConfig {
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN_SECONDS: number;
  PORT: number;
  CORS_ORIGIN: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  APP_URL: string;
}

type RawEnv = Record<string, unknown>;

const REQUIRED_KEYS = ['DATABASE_URL', 'JWT_SECRET'] as const;

const NODE_ENVS = ['development', 'test', 'production'] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function readString(config: RawEnv, key: string, fallback: string): string {
  const value = config[key];
  return isNonEmptyString(value) ? value : fallback;
}

function readOptionalString(config: RawEnv, key: string, fallback: string): string {
  const value = config[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string`);
  }
  return value.trim() || fallback;
}

function readNodeEnv(config: RawEnv): string {
  const value = readString(config, 'NODE_ENV', 'development');
  if (!(NODE_ENVS as readonly string[]).includes(value)) {
    throw new Error(
      `NODE_ENV must be one of ${NODE_ENVS.join(', ')}, received ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function readPositiveInt(config: RawEnv, key: string, fallback: number): number {
  const value = config[key];
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer, received ${JSON.stringify(value)}`);
  }
  return parsed;
}

function readMailFrom(config: RawEnv): string {
  const value = readOptionalString(config, 'MAIL_FROM', 'noreply@lokerkita.id');
  if (!value.includes('@') || /[\r\n]/.test(value)) {
    throw new Error('MAIL_FROM must contain @ and must not contain CR/LF characters');
  }
  return value;
}

function readAppUrl(config: RawEnv): string {
  const value = readOptionalString(config, 'APP_URL', '');
  if (value === '') {
    return value;
  }

  if (!/^https?:\/\//.test(value) || /[\s\\]/.test(value)) {
    throw new Error('APP_URL must be a valid URL starting with http:// or https://');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('APP_URL must be a valid URL starting with http:// or https://');
  }

  if (!url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error('APP_URL must not contain credentials, a query string, or a fragment');
  }

  return url.toString().replace(/\/+$/, '');
}

export function validateEnv(config: RawEnv): EnvConfig {
  const missing = REQUIRED_KEYS.filter((key) => !isNonEmptyString(config[key]));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv = readNodeEnv(config);
  const jwtSecret = config.JWT_SECRET as string;
  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long when NODE_ENV=production');
  }

  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: config.DATABASE_URL as string,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN_SECONDS: readPositiveInt(config, 'JWT_EXPIRES_IN_SECONDS', 86_400),
    PORT: readPositiveInt(config, 'PORT', 3000),
    CORS_ORIGIN: readString(config, 'CORS_ORIGIN', 'http://localhost:5173'),
    RESEND_API_KEY: readOptionalString(config, 'RESEND_API_KEY', ''),
    MAIL_FROM: readMailFrom(config),
    APP_URL: readAppUrl(config),
  };
}
