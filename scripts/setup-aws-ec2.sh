#!/bin/bash
# ==============================================================================
# AWS EC2 Ubuntu Automated Setup Script for Real Estate AI Calling CRM
# Installs Docker, Docker Compose, Git, UFW firewall, and prepares the environment.
# ==============================================================================

set -e

echo "🚀 Starting AWS EC2 Setup for Real Estate AI Calling CRM..."

# 1. Update OS packages
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# 3. Add Docker's official GPG key and repository
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine and Docker Compose plugin
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group (takes effect on re-login)
sudo usermod -aG docker $USER

# 6. Configure UFW Firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Nginx)
sudo ufw allow 443/tcp   # HTTPS (Nginx SSL)
sudo ufw --force enable

echo "✅ Docker and Firewall configured successfully!"
echo "👉 Next steps:"
echo "1. Clone or copy your project repository to this server."
echo "2. Copy backend/.env.example to backend/.env and populate your actual API keys (Gemini, ElevenLabs, Twilio/Exotel, etc.)."
echo "3. Run: docker compose up -d --build"
echo "4. Seed default database: docker compose exec backend npm run prisma:seed"
