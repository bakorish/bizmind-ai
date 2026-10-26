const { Sequelize } = require('sequelize');
const env = require('./env');

// Hosted providers (Neon/Render/Heroku) expose a single connection string.
if (process.env.DATABASE_URL) {
  module.exports = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false,
  });
} else {
  module.exports =
    env.DB_DIALECT === 'postgres'
      ? new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
          host: env.DB_HOST,
          port: env.DB_PORT,
          dialect: 'postgres',
          logging: false,
        })
      : new Sequelize({
          dialect: 'sqlite',
          storage: env.DB_STORAGE,
          logging: false,
        });
}
