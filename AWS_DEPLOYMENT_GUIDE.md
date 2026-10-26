# Complete AWS EC2 Deployment Guide (Native / Without Docker)

Deploy the **Real Estate AI Calling CRM** directly on **AWS EC2 Ubuntu** using **Git**, **MySQL 8 Server**, **Node.js 20**, **PM2**, and **Nginx**.

---

## Architecture on Server

```
                  [ Internet / Telephony Carriers ]
                                 │
                     Port 80 / 443 (HTTP / HTTPS)
                                 ▼
                     [ Nginx Reverse Proxy ]
                     │                      │
           /api/ & WebSockets               │ /* (UI Pages)
                     │                      │
                     ▼                      ▼
           [ NestJS Backend ]      [ Next.js Frontend ]
           (PM2: Port 4000)        (PM2: Port 3000)
                     │
                     ▼
           [ MySQL 8.0 Server ]
           (systemd: Port 3306)
```

---

## Step 1: Launch an AWS EC2 Instance

1. Open AWS Console -> **EC2** -> **Launch Instances**.
2. **Name:** `realestate-crm-server`
3. **OS Image:** **Ubuntu 24.04 LTS** or **22.04 LTS** (64-bit x86).
4. **Instance Type:** `t3.medium` (2 vCPU, 4GB RAM) recommended for smooth builds. *(Minimum: `t3.small` with 2GB swap).*
5. **Key Pair:** Select or create your key pair (`.pem` file).
6. **Security Group Inbound Rules:**
   | Type | Port | Source | Description |
   | :--- | :--- | :--- | :--- |
   | **SSH** | `22` | `0.0.0.0/0` (or your IP) | Remote terminal access |
   | **HTTP** | `80` | `0.0.0.0/0` | Public web & webhook traffic |
   | **HTTPS** | `443` | `0.0.0.0/0` | Secure SSL web & WebSockets |
7. **Storage:** 20 GB to 30 GB gp3 SSD.
8. Click **Launch Instance**.

---

## Step 2: Connect to the Server & Run Setup

1. Open terminal on your local machine and connect:
   ```bash
   ssh -i your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
   ```

2. Run the automated native setup script (or execute commands manually):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/<YOUR_GITHUB_USER>/<YOUR_REPO>/main/scripts/setup-aws-native.sh -o setup.sh
   chmod +x setup.sh
   ./setup.sh
   ```
   *This automatically installs Node.js 20, PM2, MySQL 8, Nginx, Git, and enables the firewall.*

---

## Step 3: Configure MySQL Database on the Server

1. Open MySQL as root:
   ```bash
   sudo mysql
   ```

2. Run these SQL commands (replace `YourStrongPassword123!` with your own password):
   ```sql
   CREATE DATABASE realestate_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

   CREATE USER 'crm_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YourStrongPassword123!';

   GRANT ALL PRIVILEGES ON realestate_crm.* TO 'crm_user'@'localhost';

   FLUSH PRIVILEGES;

   EXIT;
   ```

3. Verify you can connect:
   ```bash
   mysql -u crm_user -p realestate_crm
   # Enter password and type EXIT;
   ```

---

## Step 4: Clone Your Project from Git

1. Clone your repository into your home directory:
   ```bash
   git clone <YOUR_GIT_REPOSITORY_URL> realestate-crm
   cd realestate-crm
   ```

---

## Step 5: Configure & Start Backend (NestJS)

1. Create the backend `.env` file:
   ```bash
   cd backend
   cp .env.example .env
   nano .env
   ```

2. Update the environment variables in `backend/.env`:
   ```env
   # Database connection string to local MySQL
   DATABASE_URL="mysql://crm_user:YourStrongPassword123!@localhost:3306/realestate_crm"

   JWT_SECRET="generate_a_secure_random_32_character_string_here"
   JWT_EXPIRES_IN="7d"
   PORT="4000"
   FRONTEND_URL="http://<YOUR_EC2_PUBLIC_IP>"
   CORS_ORIGINS="http://<YOUR_EC2_PUBLIC_IP>,https://<YOUR_DOMAIN>"

   # ElevenLabs Voice API
   TTS_PROVIDER="elevenlabs"
   ELEVENLABS_API_KEY="your_elevenlabs_key"
   ELEVENLABS_MODEL="eleven_multilingual_v2"
   ELEVENLABS_DEFAULT_VOICE_ID="your_voice_id"

   # LLM (Gemini)
   LLM_PROVIDER="gemini"
   GEMINI_API_KEY="your_gemini_key"
   LLM_MODEL="gemini-flash-lite-latest"
   LLM_EMBED_MODEL="text-embedding-004"

   # Telephony (Twilio / Exotel / MCube)
   PUBLIC_BASE_URL="http://<YOUR_EC2_PUBLIC_IP>"
   TWILIO_ACCOUNT_SID="your_twilio_sid"
   TWILIO_AUTH_TOKEN="your_twilio_token"
   TWILIO_FROM_NUMBER="your_twilio_number"
   ```
   *(Press `Ctrl + O` then `Enter` to save, `Ctrl + X` to exit).*

3. Install dependencies, generate Prisma client, push schema to MySQL, and build:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run prisma:seed
   npm run build
   ```

4. Start Backend with PM2:
   ```bash
   pm2 start dist/main.js --name "crm-backend"
   ```

---

## Step 6: Configure & Start Frontend (Next.js)

1. Navigate to frontend folder and install:
   ```bash
   cd ../frontend
   npm install
   ```

2. Set up environment variable for frontend:
   ```bash
   nano .env.local
   ```
   Add:
   ```env
   NEXT_PUBLIC_API_URL="/api"
   ```

3. Build the Next.js application:
   ```bash
   npm run build
   ```

4. Start Frontend with PM2:
   ```bash
   pm2 start npm --name "crm-frontend" -- start -- -p 3000
   ```

5. Save PM2 state so apps automatically restart on server reboots:
   ```bash
   pm2 save
   pm2 startup
   # Run the command generated on screen by pm2 startup
   ```

---

## Step 7: Configure Nginx Reverse Proxy

1. Copy the Nginx configuration:
   ```bash
   sudo cp /home/ubuntu/realestate-crm/nginx/realestate-crm.nginx.conf /etc/nginx/sites-available/realestate-crm
   ```

2. Enable the site and disable the default site:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/realestate-crm /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

3. Test and restart Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

👉 **Your application is now live on `http://<YOUR_EC2_PUBLIC_IP>`!**

---

## Step 8: Adding a Free SSL Certificate (HTTPS & WSS)

Telephony carriers (Twilio, Exotel, MCube) require secure `https://` webhooks.

1. Point your domain (e.g. `crm.yourdomain.com`) to your EC2 Public IP using an **A Record** in your DNS.
2. Edit `/etc/nginx/sites-available/realestate-crm` and replace `server_name _;` with `server_name crm.yourdomain.com;`.
3. Install Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```
4. Run Certbot:
   ```bash
   sudo certbot --nginx -d crm.yourdomain.com
   ```
   Certbot will automatically obtain the certificate and update your Nginx configuration.

---

## Step 9: Future Code Updates (One-Click)

Whenever you push new changes to GitHub, update your server anytime by running:
```bash
cd ~/realestate-crm
bash scripts/deploy-on-server.sh
```
