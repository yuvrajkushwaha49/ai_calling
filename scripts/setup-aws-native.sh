#!/bin/bash
# ==============================================================================
# AWS EC2 Ubuntu Native Setup Script (Without Docker)
# Installs Node.js 20, PM2, MySQL Server, Nginx, and configures Firewall.
# ==============================================================================

set -e

echo "🚀 Starting AWS EC2 Native Setup (Node.js 20, MySQL, PM2, Nginx)..."

# 1. Update OS packages
sudo apt update -y
sudo apt upgrade -y

# 2. Install basic tools
sudo apt install -y curl wget git ufw software-properties-common ca-certificates

# 3. Install Node.js 20 (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 4. Install PM2 globally for background process management
sudo npm install -g pm2

# 5. Install MySQL Server
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql

# 6. Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 7. Configure UFW Firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

echo "✅ Server dependencies installed successfully!"
echo "--------------------------------------------------"
echo "👉 Next step: Configure your MySQL database by running:"
echo "sudo mysql"
echo ""
echo "And paste:"
echo "CREATE DATABASE realestate_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';"
echo "GRANT ALL PRIVILEGES ON realestate_crm.* TO 'crm_user'@'localhost';"
echo "FLUSH PRIVILEGES;"
echo "EXIT;"
echo "--------------------------------------------------"
