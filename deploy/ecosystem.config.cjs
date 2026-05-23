/**
 * PM2 — nomi dedicati per non confondere con altri progetti sul server.
 * PORT letta da server/.env (dotenv in loadEnv).
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 restart libery-api libery-worker   # mai: pm2 restart all
 */
const port = process.env.LIBERY_PORT || process.env.PORT || '3012';

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
        PORT: port,
      },
    },
    {
      name: 'libery-worker',
      cwd: './server',
      script: 'dist/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: port,
      },
    },
  ],
};
