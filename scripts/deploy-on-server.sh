#!/bin/bash
# ==============================================================================
# One-click Re-Deployment Script on AWS EC2
# Pulls latest code from Git, runs migrations, builds, and reloads PM2.
# ==============================================================================

set -e

echo "🔄 Pulling latest changes from Git..."
git pull origin main

echo "📦 Updating Backend..."
cd backend
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart crm-backend || pm2 start dist/main.js --name "crm-backend"

echo "📦 Updating Frontend..."
cd ../frontend
npm install
npm run build
pm2 restart crm-frontend || pm2 start npm --name "crm-frontend" -- start -- -p 3000

echo "💾 Saving PM2 process list..."
pm2 save

echo "🎉 Deployment updated and live!"
