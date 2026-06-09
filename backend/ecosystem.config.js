module.exports = {
  apps: [{
    name: "vce-forge-api",
    script: "dist/index.js",
    cwd: __dirname,
    instances: 1,
    exec_mode: "fork",
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: {
      NODE_ENV: "production"
    }
  }]
};
