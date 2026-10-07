const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize =
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

module.exports = sequelize;
