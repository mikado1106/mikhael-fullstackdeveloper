export interface EnvConfig {
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN_SECONDS: number;
  PORT: number;
  CORS_ORIGIN: string;
}

type RawEnv = Record<string, unknown>;

const REQUIRED_KEYS = ['DATABASE_URL', 'JWT_SECRET'] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function readString(config: RawEnv, key: string, fallback: string): string {
  const value = config[key];
  return isNonEmptyString(value) ? value : fallback;
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

export function validateEnv(config: RawEnv): EnvConfig {
  const missing = REQUIRED_KEYS.filter((key) => !isNonEmptyString(config[key]));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv = readString(config, 'NODE_ENV', 'development');
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
  };
}
