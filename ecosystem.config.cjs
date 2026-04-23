// pm2 process config for the VPS.
// Usage on the VPS (after `npm run build`):
//   pm2 startOrReload ecosystem.config.cjs
//   pm2 save           # persist the process list so it survives a reboot
//   pm2 startup        # (once) generate the init script to restore pm2 on boot

module.exports = {
  apps: [
    {
      name: "flashduration",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "384M",
      env: { NODE_ENV: "production" },
      error_file: "logs/pm2.err.log",
      out_file: "logs/pm2.out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
