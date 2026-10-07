const fs = require('fs');
const path = require('path');
const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');

async function main() {
  if (env.DB_DIALECT === 'sqlite') {
    const dir = path.dirname(path.resolve(env.DB_STORAGE));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  await sequelize.authenticate();

  // Auto-sync schema (academia scope). Production would use migrations.
  await sequelize.sync();

  app.listen(env.PORT, () => {
    console.log(`BizMind API listening on http://localhost:${env.PORT} [${env.DB_DIALECT}]`);
    console.log(`AI service expected at ${env.AI_SERVICE_URL}`);
  });
}

main().catch((err) => {
  console.error('Failed to start BizMind API:', err.message);
  process.exit(1);
});
