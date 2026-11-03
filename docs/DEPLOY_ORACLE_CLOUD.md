# Deploy SkoolMate OS on Oracle Cloud (Free Tier) — Zero Cost

This guide deploys SkoolMate OS on Oracle Cloud's **Always Free** tier using the
existing Docker setup. No Vercel, no paid hosting, no bandwidth limits.

## What you get for free (Oracle Cloud Always Free)
- 2 AMD-based Compute VMs (1/8 OCPU, 1 GB RAM each) **or** 4 ARM-based (Ampere A1) with up to **4 OCPUs and 24 GB RAM** (recommended).
- 200 GB block storage.
- 10 TB/month outbound data transfer.
- No credit card charges if you stay within Always Free limits.

## Prerequisites
- Oracle Cloud account (https://cloud.oracle.com) — sign up with a credit card for verification (not charged if you stay free).
- Your `.env.local` values (Supabase URL, keys, etc.).
- SSH key pair for VM access.

## Step 1 — Create the VM

1. Log in to Oracle Cloud Console → **Compute → Instances → Create Instance**.
2. Choose **Ampere (ARM)** shape: `VM.Standard.A1.Flex`.
   - Set OCPUs to **2** and Memory to **12 GB** (well within free limits).
3. Image: **Ubuntu 22.04 (aarch64)**.
4. Add your SSH public key.
5. Create a **Reserved Public IP** and assign it to the instance.
6. Note the public IP — this is your server address.

## Step 2 — Configure networking

1. Go to **Networking → Virtual Cloud Networks → your VCN → Security Lists**.
2. Add Ingress Rules:
   - **TCP 22** (SSH) — source `0.0.0.0/0`
   - **TCP 80** (HTTP) — source `0.0.0.0/0`
   - **TCP 443** (HTTPS) — source `0.0.0.0/0`
   - **TCP 3000** (app, temporary) — source `0.0.0.0/0`

## Step 3 — SSH into the VM and install Docker

```bash
ssh ubuntu@<YOUR_PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# Log out and back in for group change
exit
ssh ubuntu@<YOUR_PUBLIC_IP>

# Verify
docker --version
docker compose version
```

## Step 4 — Clone and configure the app

```bash
git clone https://github.com/mcmikem/schoolx.git
cd schoolx

# Create production env file
cp .env.local .env
# Edit .env with your production values (Supabase, etc.)
nano .env
```

Make sure these are set in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=your-cron-secret
```

## Step 5 — Build and run

```bash
# Build the Docker image (takes ~5-10 min on first run)
DOCKER_BUILD=1 docker compose -f docker-compose.prod.yml build

# Start the app
docker compose -f docker-compose.prod.yml up -d

# Check health
docker compose -f docker-compose.prod.yml ps
curl http://localhost:3000/api/health/
```

The app is now running on port 3000. Visit `http://<YOUR_PUBLIC_IP>:3000`.

## Step 6 — Set up HTTPS with Caddy (reverse proxy)

Caddy handles SSL certificates automatically (Let's Encrypt).

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# Configure Caddy
sudo tee /etc/caddy/Caddyfile << 'EOF'
your-domain.com {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
```

Replace `your-domain.com` with your actual domain. Point your domain's DNS A record to the VM's public IP.

## Step 7 — (Optional) Cloudflare proxy for CDN/caching

1. Add your domain to Cloudflare (free plan).
2. Point DNS A record to the VM's public IP (proxied/orange cloud).
3. Cloudflare caches static assets and provides DDoS protection for free.
4. This also hides the VM's real IP.

## Updating the app

### Manual
```bash
cd ~/schoolx
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Automatic (GitHub Actions)
A workflow is included at `.github/workflows/deploy-oracle.yml`. On every push to `main`,
it SSHes into the VM, pulls, builds, and restarts automatically.

**One-time setup — add these GitHub Secrets** (repo → Settings → Secrets and variables → Actions):
| Secret | Value |
|---|---|
| `ORACLE_HOST` | Your VM's public IP |
| `ORACLE_USER` | `ubuntu` (or your SSH user) |
| `ORACLE_SSH_KEY` | Contents of your **private** SSH key (`~/.ssh/id_rsa` or `id_ed25519`) |

Generate a dedicated deploy key (recommended):
```bash
ssh-keygen -t ed25519 -C "deploy@skoolmate" -f ~/.ssh/skoolmate_deploy
# Add the PUBLIC key to the VM: cat ~/.ssh/skoolmate_deploy.pub >> ~/.ssh/authorized_keys
# Add the PRIVATE key to GitHub Secrets as ORACLE_SSH_KEY
```

You can also trigger a deploy manually: GitHub → Actions → "Deploy to Oracle Cloud" → "Run workflow".

## Backups

```bash
# Backup .env
cp .env .env.backup

# Database is on Supabase (hosted) — no local DB backup needed.
# If you self-host Supabase later, add pg_dump to cron.
```

## Monitoring

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f app

# Check health
curl http://localhost:3000/api/health/

# Check container stats
docker stats
```

## Cost summary

| Item | Cost |
|---|---|
| Oracle Cloud VM (2 OCPU, 12GB RAM, ARM) | **Free** (Always Free) |
| 200 GB storage | **Free** |
| 10 TB/month bandwidth | **Free** |
| Domain (e.g., .com) | ~$10/year (optional, can use free subdomain) |
| SSL certificate | **Free** (Let's Encrypt via Caddy) |
| Cloudflare CDN | **Free** |
| **Total** | **$0/month** (plus optional domain) |

## Troubleshooting

- **Build fails with OOM:** Increase VM memory or reduce `org.gradle.jvmargs` in `gradle.properties`. For the Node build, ensure at least 2GB RAM.
- **Port 3000 not accessible:** Check Oracle Cloud security list ingress rules and `ufw`/`iptables` on the VM.
- **App crashes on start:** Check `docker compose logs app` for errors. Common: missing env vars.
- **Health check fails:** Wait 2 minutes (start_period). If still failing, check logs.