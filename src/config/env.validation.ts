const SUPPORTED_NODE_ENVS = new Set(['development', 'test', 'production']);

function readString(
  config: Record<string, unknown>,
  key: string,
  defaultValue?: string,
): string {
  const rawValue = config[key];
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (value) {
    return value;
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new Error(`Environment variable ${key} is required.`);
}

function readInteger(
  config: Record<string, unknown>,
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const rawValue = config[key];
  const value =
    rawValue === undefined || rawValue === '' ? defaultValue : Number(rawValue);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `Environment variable ${key} must be an integer between ${min} and ${max}.`,
    );
  }

  return value;
}

function readCorsOrigins(config: Record<string, unknown>): string {
  const value = readString(config, 'CORS_ORIGINS', 'http://localhost:5173');
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) {
    throw new Error(
      'CORS_ORIGINS must contain one or more explicit HTTP(S) origins; wildcard is not allowed.',
    );
  }

  const normalizedOrigins = origins.map((origin) => {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(parsedOrigin.protocol) ||
      parsedOrigin.pathname !== '/' ||
      parsedOrigin.search ||
      parsedOrigin.hash
    ) {
      throw new Error(
        `CORS_ORIGINS entries must be HTTP(S) origins without a path: ${origin}`,
      );
    }

    return parsedOrigin.origin;
  });

  return normalizedOrigins.join(',');
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = readString(config, 'NODE_ENV', 'development');
  if (!SUPPORTED_NODE_ENVS.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const jwtSecret = readString(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: readInteger(config, 'PORT', 3000, 1, 65535),
    CORS_ORIGINS: readCorsOrigins(config),
    DB_HOST: readString(config, 'DB_HOST'),
    DB_PORT: readInteger(config, 'DB_PORT', 5432, 1, 65535),
    DB_USERNAME: readString(config, 'DB_USERNAME'),
    DB_PASSWORD: readString(config, 'DB_PASSWORD'),
    DB_NAME: readString(config, 'DB_NAME'),
    JWT_SECRET: jwtSecret,
  };
}
