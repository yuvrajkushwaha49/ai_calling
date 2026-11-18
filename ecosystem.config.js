module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: '/home/ubuntu/realestate-crm/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DEPLOYMENT_ID: 'workains-prod-round8.3',
      },
    },
    {
      name: 'crm-frontend',
      cwd: '/home/ubuntu/realestate-crm/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};

