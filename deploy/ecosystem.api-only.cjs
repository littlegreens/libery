/**
 * Deploy fase 1 — solo API, senza Redis/worker.
 * Notifiche in-app: PostgreSQL (polling client), funzionano senza Redis.
 *
 *   pm2 start deploy/ecosystem.api-only.cjs
 *   pm2 restart libery-api
 */
module.exports = {
  apps: [
    {
      name: 'libery-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
