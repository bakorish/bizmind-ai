require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'bizmind-dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Database. Spec targets PostgreSQL; SQLite is supported as a zero-config
  // local/demo fallback so the project runs anywhere.
  DB_DIALECT: process.env.DB_DIALECT || 'sqlite',
  DB_STORAGE: process.env.DB_STORAGE || './data/bizmind.sqlite',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'bizmind',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASS: process.env.DB_PASS || '',

  // AI microservice (Python/FastAPI)
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8001',

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'bizmind-dev-secret-change-in-production') {
  // NFR-05: fail loudly rather than run production on a known secret.
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
