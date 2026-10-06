import { validateEnvironment } from './env.validation';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  CORS_ORIGINS: 'http://localhost:5173',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'devflow',
  DB_PASSWORD: 'local-test-password',
  DB_NAME: 'devflow_test',
  JWT_SECRET: 'a-test-secret-that-is-at-least-32-characters-long',
};

describe('validateEnvironment', () => {
  it('parses valid values and applies typed defaults', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result).toMatchObject({
      NODE_ENV: 'test',
      PORT: 3000,
      CORS_ORIGINS: 'http://localhost:5173',
      DB_PORT: 5432,
      DB_HOST: 'localhost',
      DB_NAME: 'devflow_test',
    });
  });

  it('rejects a missing required database setting', () => {
    const environment = { ...validEnvironment, DB_HOST: '' };

    expect(() => validateEnvironment(environment)).toThrow(
      'DB_HOST is required',
    );
  });

  it('rejects invalid ports', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, PORT: '70000' }),
    ).toThrow('PORT must be an integer');
  });

  it('rejects a weak JWT secret', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, JWT_SECRET: 'too-short' }),
    ).toThrow('JWT_SECRET must be at least 32 characters');
  });

  it('rejects wildcard CORS origins', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, CORS_ORIGINS: '*' }),
    ).toThrow('wildcard is not allowed');
  });
});
