/**
 * Konfigurasi PM2 untuk aaPanel.
 *
 * Port sengaja 3001 agar tidak bentrok dengan aplikasi Node lain di server
 * (mikrosetting_website umumnya memakai 3000). Ubah PORT di bawah bila perlu,
 * lalu sesuaikan juga target reverse proxy di Nginx.
 *
 * Pakai:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js --update-env
 *   pm2 logs generator-mikrotik
 */
module.exports = {
  apps: [
    {
      name: "generator-mikrotik",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
