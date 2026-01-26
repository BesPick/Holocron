# BESPIN Holocron

BESPIN Holocron is BESPIN's internal operations suite: a single Next.js app that hosts multiple tools behind one shared shell. The vision is to build focused modules (morale, host operations, games) without fragmenting auth, data, or UX.

## Table of Contents

*DISCLAIMER: This README was generated using Chatgpt then edited by the developers. Please direct questions, comments, or error findings to a developer for help.*

- [Vision](#vision)
- [Purpose & Design](#purpose--design)
- [Tool Suite](#tool-suite)
  - [Morale (Live)](#morale-live)
  - [HostHub (In Development)](#hosthub-in-development)
  - [Admin Settings (Live)](#admin-settings-live)
  - [Games (In Development)](#games-in-development)
- [Tech Stack](#tech-stack)
- [Architecture & Data Flow](#architecture--data-flow)
- [Developer Notes](#developer-notes)
- [Getting Started (Step-by-Step)](#getting-started-step-by-step)
  - [Prerequisites](#prerequisites)
  - [1) Clone the repo](#1-clone-the-repo)
  - [2) Install Node 20.11.1](#2-install-node-20111)
  - [3) Install dependencies](#3-install-dependencies)
  - [4) Create your environment file](#4-create-your-environment-file)
  - [5) Run the app locally](#5-run-the-app-locally)
  - [6) Configure Clerk (required for sign-in)](#6-configure-clerk-required-for-sign-in)
  - [7) Optional: enable PayPal Boost](#7-optional-enable-paypal-boost)
  - [8) Optional: enable Mattermost notifications](#8-optional-enable-mattermost-notifications)
- [Environment Variables](#environment-variables)
  - [Required](#required)
  - [Optional: Access control](#optional-access-control)
  - [Optional: PayPal](#optional-paypal)
  - [Optional: Mattermost](#optional-mattermost)
  - [Optional: App metadata](#optional-app-metadata)
- [Directory Layout](#directory-layout)
- [Authentication & Roles](#authentication--roles)
- [Deployment Notes](#deployment-notes)
  - [Source Control & Live Updates](#source-control--live-updates)
  - [Staging Instance (EC2)](#staging-instance-ec2)
  - [Versioning & Release Workflow](#versioning--release-workflow)
  - [AWS EC2 Deployment (Holocron)](#aws-ec2-deployment-holocron)
    - [Instance setup (EC2)](#instance-setup-ec2)
    - [Server bootstrap (on the instance)](#server-bootstrap-on-the-instance)
    - [Environment updates (critical commands)](#environment-updates-critical-commands)
    - [systemd service (holocron)](#systemd-service-holocron)
    - [Nginx reverse proxy](#nginx-reverse-proxy)
    - [SSL with Cloudflare (recommended)](#ssl-with-cloudflare-recommended)
    - [Common AWS errors and fixes](#common-aws-errors-and-fixes)

---

## Vision

- A modular tool hub that keeps navigation, auth, and data consistent across all tools.
- Fast internal workflows over generic dashboards; each tool is a focused control panel.
- Lightweight infrastructure: SQLite + Clerk metadata instead of heavyweight services.
- A shared foundation that lets new tools ship quickly without rewriting plumbing.

## Purpose & Design

This project is a single web app that holds multiple internal tools under one roof.
Instead of building separate apps for each team need (morale, scheduling, games),
we keep one shared login, one database, and one navigation shell. That makes it
easier to maintain and easier for teammates to use.

The app is built on Next.js (a React framework). It uses Clerk for login and
stores data in a local SQLite database file. Each tool is a "module" that lives
in its own folder but shares the same auth and layout. In practice, you sign in
once and then move between tools from the same header.

## Tool Suite

### Morale (Live)

- Announcements, polls, and voting events with scheduling, auto-archive, and auto-delete.
- Polls support multi-select, anonymous mode, and admin-only voter breakdowns.
- Voting events support per-vote pricing, per-user add/remove limits, and leaderboard modes driven by group/portfolio metadata.
- Zero-cost voting submissions when pricing is disabled.
- Boost contributions via PayPal checkout.
- Admin workflows: create/edit, scheduled queue, roster/role management.

### HostHub (In Development)

- Personal schedule view for standup, demo day, and security shifts.
- Calendar view for upcoming assignments across the roster.
- Docs hub embedding the standup schedule, "About Me" guidance, and Demo Day docs.
- Demo Day history export (CSV download).
- Admin scheduling settings UI is in development.

HostHub assignment rules (current):

- Standup shifts auto-assign for Mondays and Thursdays.
- Demo Day auto-assigns the first Wednesday of each month.
- Security shifts auto-assign Monday through Friday with AM/PM windows.
- Eligibility is derived from Clerk publicMetadata (rankCategory + rank).

### Admin Settings (Live)

- Manage metadata options (groups, portfolios, teams, and custom sections).
- Configure the landing-page warning banner and profile warning nudges.
- Configure Mattermost notifications and send test messages.

### Games (In Development)

- Placeholder hub for short, lightweight games.
- Future game modules will plug into the same navigation shell.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS 4, tw-animate-css, class-variance-authority, tailwind-variants.
- **UI primitives**: Radix UI components + lucide-react icons.
- **Data layer**: Drizzle ORM + SQLite (better-sqlite3).
- **Auth & user data**: Clerk (roles and publicMetadata for group/portfolio/rank).
- **Payments**: PayPal JS SDK via `@paypal/react-paypal-js`.
- **Tooling**: ESLint 9, TypeScript 5, Vitest, Vite (test runner).

## Architecture & Data Flow

```text
Next.js App Router -> Server Actions / API Routes -> SQLite (Drizzle)
                   -> Clerk (auth + metadata)
```

- Client components call `useApiQuery` / `useApiMutation`, routed via `src/app/api/rpc/route.ts`.
- Server actions and services live in `src/server/actions` and `src/server/services`.
- Live updates for Morale use SSE (`src/app/api/stream/route.ts` + `src/lib/liveEvents`).
- Site-wide settings live in the `site_settings` table and are managed via `/admin/settings`.
- Persistent uploads live in `public/uploads` and are tracked in the `uploads` table.

## Developer Notes

- The app lives in `bespick/` (this README sits at the repo root).
- SQLite database file is created at `bespick/data/bespick.sqlite` on first run.
- HostHub schedule rules and Google Docs links live in `src/server/services/hosthub-schedule.ts` and `src/lib/hosthub-docs.ts`.
- Database tables of note: `announcements`, `poll_votes`, `uploads`, `demo_day_assignments`, `standup_assignments`, `security_shift_assignments`, `site_settings`.
- Clerk `publicMetadata` fields in use today: `role`, `group`, `portfolio`, `rankCategory`, `rank`, `team`.
- `publishDue` is invoked by the Morale dashboard to auto-publish, archive, and delete scheduled items.
- If you change Node versions, run `npm rebuild better-sqlite3` to refresh the native module.
- Tests run with `npm run test` (Vitest). Lint with `npm run lint`.

## Getting Started (Step-by-Step)

### Prerequisites

- Node.js 20.11.1 (pinned in `bespick/.nvmrc` and `bespick/package.json` `engines`).
- npm 9+ (or pnpm/bun/yarn if you prefer).
- Clerk application (publishable + secret keys).
- Optional: PayPal REST app if you want Boost contributions enabled.
- Optional: Mattermost bot token if you want shift/announcement notifications.

### 1) Clone the repo

```bash
git clone <repo-url> holocron
cd holocron
```

### 2) Install Node 20.11.1

If you use nvm (recommended):

```bash
cd bespick
nvm install 20.11.1
nvm use 20.11.1
node -v
```

### 3) Install dependencies

```bash
cd bespick
npm install
```

### 4) Create your environment file

Create `bespick/.env.local` (this file is not committed):

```bash
cd bespick
cat > .env.local <<'EOF'
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_your_key_here
CLERK_SECRET_KEY=sk_your_key_here
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in

# Access control (optional - defaults to teambespin.us)
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=teambespin.us
ALLOWED_EMAIL_DOMAIN=teambespin.us
CLERK_WEBHOOK_SECRET=

# App URL (used for absolute links in notifications)
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000

# PayPal (optional - leave blank if you do not need Boost payments)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
NEXT_PUBLIC_PAYPAL_CURRENCY=USD
NEXT_PUBLIC_PAYPAL_BUYER_COUNTRY=US
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_BRAND_NAME=Morale

# Mattermost (optional - for notifications)
MATTERMOST_URL=
MATTERMOST_BOT_TOKEN=
MATTERMOST_EVENT_CHANNEL_ID=
MATTERMOST_BOT_USER_ID=
EOF
```

### 5) Run the app locally

```bash
cd bespick
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:3000`).
If port 3000 is already in use, Next.js will pick 3001 and print it.

### 6) Configure Clerk (required for sign-in)

1. Create a Clerk application in the Clerk dashboard.
2. Copy the publishable + secret keys into `.env.local`.
3. In Clerk, add `http://localhost:3000` as an allowed origin and redirect.
4. Start the app and create a test user via `/sign-up`.

### 7) Optional: enable PayPal Boost

1. Create a PayPal REST app (sandbox first).
2. Fill in the PayPal values in `.env.local`.
3. Keep `PAYPAL_ENVIRONMENT=sandbox` until you test the full checkout flow.
4. Switch to `live` when you are ready for real payments.

### 8) Optional: enable Mattermost notifications

1. Create or reuse a Mattermost bot account and generate a bot token.
2. Set `MATTERMOST_URL`, `MATTERMOST_BOT_TOKEN`, and `MATTERMOST_EVENT_CHANNEL_ID` in `.env.local`.
3. Set `NEXT_PUBLIC_APP_URL` or `APP_BASE_URL` so notifications can link back to Holocron.
4. Open `/admin/settings` to toggle which notifications are sent and to send a test message.

## Environment Variables

### Required

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend key from your Clerk instance. |
| `CLERK_SECRET_KEY` | Server-side Clerk secret. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` / `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Routes for auth flows (defaults already match `/sign-*`). |

### Optional: Access control

| Variable | Description |
| --- | --- |
| `ALLOWED_EMAIL_DOMAIN` | Server-side allowed email domain for sign-ups (defaults to `teambespin.us`). |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | Client-side allowed domain shown on auth screens (defaults to `teambespin.us`). |
| `CLERK_WEBHOOK_SECRET` | Enable `/api/clerk/webhook` to auto-delete disallowed sign-ups. |

### Optional: PayPal

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client ID from your PayPal REST app (sandbox or live). Used in the browser to load the PayPal JS SDK. |
| `NEXT_PUBLIC_PAYPAL_CURRENCY` | Optional currency override for the PayPal JS SDK (defaults to `USD`). |
| `NEXT_PUBLIC_PAYPAL_BUYER_COUNTRY` | Optional buyer country override (defaults to `US`). |
| `PAYPAL_CLIENT_ID` | Same PayPal client ID, used server-side when exchanging OAuth tokens. |
| `PAYPAL_CLIENT_SECRET` | PayPal secret used on the server to request OAuth tokens. |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `live` to control which PayPal base URL is used. |
| `PAYPAL_BRAND_NAME` | Friendly brand label shown during PayPal checkout (defaults to `Morale`). |
| `PAYPAL_API_BASE_URL` | Optional override if PayPal gives you a regional API domain. |

> The PayPal client ID appears twice on purpose: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is safe to expose to the browser to bootstrap the PayPal JS SDK, while `PAYPAL_CLIENT_ID` stays on the server (together with `PAYPAL_CLIENT_SECRET`) so we can exchange OAuth tokens without leaking secrets.

### Optional: Mattermost

| Variable | Description |
| --- | --- |
| `MATTERMOST_URL` | Base URL for your Mattermost instance (example: `https://chat.example.com`). |
| `MATTERMOST_BOT_TOKEN` | Bot token used to post messages. |
| `MATTERMOST_EVENT_CHANNEL_ID` | Channel ID for event notifications. |
| `MATTERMOST_BOT_USER_ID` | Optional explicit bot user ID (auto-fetched if omitted). |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_BASE_URL` | Base URL used to build links inside notifications. |

### Optional: App metadata

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_APP_VERSION` | Optional override for the footer version string (defaults to `package.json`). |
| `NEXT_PUBLIC_GIT_SHA` | Optional short git SHA shown in the footer. |

## Directory Layout

```text
bespick/
├─ data/                  # SQLite database file (created on first run)
├─ src/
│  ├─ app/                # Next.js App Router routes
│  │  ├─ (landing)/       # Holocron landing page
│  │  ├─ (tools)/
│  │  │  ├─ admin/        # Admin settings pages
│  │  │  ├─ morale/       # Morale tool routes
│  │  │  ├─ hosthub/      # HostHub tool routes
│  │  │  └─ games/        # Games tool routes
│  │  └─ api/             # API routes (rpc, stream, payments, admin)
│  ├─ components/         # Shared UI (forms, modals, headers)
│  ├─ server/             # Server actions, services, auth helpers
│  ├─ lib/                # Client utilities + tool-specific helpers
│  └─ types/              # Global TypeScript definitions
├─ public/                # Static assets
│  └─ uploads/            # User-uploaded images (created at runtime)
└─ README.md              # Tool suite documentation
```

## Authentication & Roles

- **Clerk middleware** (`src/proxy.ts`) forces authentication for every route except `/sign-in` and `/sign-up`.
- **Morale admin routes** (`/morale/admin/*`) require role `admin` or `moderator`.
- **Admin settings** (`/admin/settings`) are restricted to role `admin` via `checkRole` on the server.
- **Role values** are defined in `src/types/globals.d.ts` (`'admin' | 'moderator' | ''`).
- **Granting roles** can be done via `/morale/admin/roster` (uses `updateUserRole`) or directly in the Clerk dashboard by editing a user's `publicMetadata.role`.
- **Group, portfolio, rank, and team** metadata live in `publicMetadata` and power voting and HostHub eligibility.
- **Auto-delete disallowed signups**: configure a Clerk webhook pointing to `/api/clerk/webhook` and set `CLERK_WEBHOOK_SECRET`. New users without an allowed email domain are deleted automatically.

## Deployment Notes

- **Next.js**: Deploy on Vercel (recommended) or any Node-compatible host. Ensure build environment has the same environment variables listed above.
- **Clerk**: Configure production URLs for sign-in/sign-up. Copy the live publishable + secret keys into your production environment.
- **SQLite storage**: Persist `data/` and `public/uploads` if your host wipes the filesystem on deploy. Use a mounted volume for Docker or a persistent disk on VMs.
- **Node version**: Use Node 20.11.1 in production to avoid native module mismatches with `better-sqlite3`.
- **Automation**: In production, keep the dashboard (or a scheduled job) calling `announcements.publishDue` so scheduled posts, auto-deletes, and auto-archives stay accurate. A simple approach is to configure a Vercel Cron task that hits a lightweight API route invoking the mutation at a fixed cadence.

### Source Control & Live Updates

**Local development workflow (laptop):**

```bash
git status
git add .
git commit -m "Your message"
git push origin main
```

**Apply updates to the live server (EC2):**

```bash
cd /home/ubuntu/holocron/bespick
git pull --no-rebase origin main
npm run deploy
```

`npm run deploy` rebuilds the app, updates systemd env vars with the version + git SHA,
and restarts the service so the live site reflects the new code.

### Staging Instance (EC2)

Run a separate staging copy on the same EC2 so you can test changes without
touching the live site.

**1) Create a staging checkout:**

```bash
cd /home/ubuntu
git clone https://github.com/BesPick/BesPick.git holocron-staging
cd /home/ubuntu/holocron-staging/bespick
cp /home/ubuntu/holocron/bespick/.env ./.env
```

**2) Install deps and build via staging deploy:**

```bash
npm install --include=dev
npm run deploy:staging
```

**3) Create a staging systemd service:**

```bash
sudo tee /etc/systemd/system/holocron-staging.service >/dev/null <<'EOF'
[Unit]
Description=Holocron Next.js App (Staging)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/holocron-staging/bespick
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=PATH=/home/ubuntu/.nvm/versions/node/v20.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/home/ubuntu/.nvm/versions/node/v20.11.1/bin/node /home/ubuntu/holocron-staging/bespick/.next/standalone/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable holocron-staging
sudo systemctl start holocron-staging
```

**4) Add Nginx for staging (subdomain):**

```bash
sudo tee /etc/nginx/sites-available/holocron-staging >/dev/null <<'EOF'
server {
  listen 80;
  server_name staging.holocron.aodom.dev;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name staging.holocron.aodom.dev;

  ssl_certificate /etc/ssl/cloudflare/holocron.aodom.dev.pem;
  ssl_certificate_key /etc/ssl/cloudflare/holocron.aodom.dev.key;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

sudo ln -sf /etc/nginx/sites-available/holocron-staging /etc/nginx/sites-enabled/holocron-staging
sudo nginx -t
sudo systemctl restart nginx
```

Now you can test at `https://staging.holocron.aodom.dev` while production
stays untouched.

### Versioning & Release Workflow

1. Update `CHANGELOG.md` by moving items from **[Unreleased]** into a new version section.
2. Bump the version:
   - `npm run release:patch` (or `release:minor` / `release:major`)
3. Commit and push.
4. On the server, pull + rebuild + restart:

```bash
cd /home/ubuntu/holocron/bespick
git pull
npm run deploy
```

`npm run deploy` updates the systemd env with the current `package.json` version
and git SHA, rebuilds the app, and restarts the service so the footer shows the
exact build.

### AWS EC2 Deployment (Holocron)

This setup runs the app on an Ubuntu EC2 instance with systemd and Nginx.

#### Instance setup (EC2)

1. Use Ubuntu 22.04 LTS on a free-tier micro instance (t2.micro or t3.micro).
2. Attach an Elastic IP so your DNS does not change.
3. Security group inbound rules:
   - SSH (22) from your IP only.
   - HTTP (80) and HTTPS (443) from `0.0.0.0/0`.

#### Server bootstrap (on the instance)

```bash
sudo apt update
sudo apt install -y git build-essential python3 curl nginx
```

Install Node 20.11.1 via nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20.11.1
nvm use 20.11.1
```

Clone and build:

```bash
git clone <repo-url> holocron
cd holocron/bespick
npm install
npm run build
```

If `npm run build` is killed on a tiny instance, add swap and retry:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
npm run build
```

#### Environment updates (critical commands)

Production uses `.env` on the server. `NEXT_PUBLIC_*` values are baked at build time.

```bash
nano /home/ubuntu/holocron/bespick/.env
npm run build
sudo systemctl restart holocron
```

Quick checks:

```bash
sudo systemctl status holocron
sudo journalctl -u holocron -n 200 --no-pager
```

#### systemd service (holocron)

Create `/etc/systemd/system/holocron.service`:

```text
[Unit]
Description=Holocron Next.js App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/holocron/bespick
Environment=NODE_ENV=production
Environment=PATH=/home/ubuntu/.nvm/versions/node/v20.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/home/ubuntu/.nvm/versions/node/v20.11.1/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

This project uses Next.js standalone output, so `npm start` runs the
`.next/standalone/server.js` build (the deploy script copies `public`
and `.next/static` into the standalone folder).

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable holocron
sudo systemctl start holocron
```

#### Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/holocron >/dev/null <<'EOF'
server {
  listen 80;
  server_name holocron.aodom.dev;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/holocron /etc/nginx/sites-enabled/holocron
sudo nginx -t
sudo systemctl restart nginx
```

Verify locally:

```bash
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1
```

#### SSL with Cloudflare (recommended)

1. In Cloudflare DNS, create an `A` record for `holocron.aodom.dev` pointing to your Elastic IP (proxied/orange cloud).
2. In Cloudflare SSL/TLS, set mode to `Full (strict)`.
3. Create an Origin Certificate for `holocron.aodom.dev`, then save the cert + key on the server:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo tee /etc/ssl/cloudflare/holocron.aodom.dev.pem >/dev/null <<'EOF'
# PASTE ORIGIN CERT HERE
EOF
sudo tee /etc/ssl/cloudflare/holocron.aodom.dev.key >/dev/null <<'EOF'
# PASTE PRIVATE KEY HERE
EOF
sudo chmod 600 /etc/ssl/cloudflare/holocron.aodom.dev.key
```

Update Nginx to listen on 443 with those files and redirect HTTP -> HTTPS.

```bash
sudo tee /etc/nginx/sites-available/holocron >/dev/null <<'EOF'
server {
  listen 80;
  server_name holocron.aodom.dev;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name holocron.aodom.dev;

  ssl_certificate /etc/ssl/cloudflare/holocron.aodom.dev.pem;
  ssl_certificate_key /etc/ssl/cloudflare/holocron.aodom.dev.key;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

sudo nginx -t
sudo systemctl restart nginx
```

#### Common AWS errors and fixes

- **`ERR_CONNECTION_REFUSED` in browser**: You are opening `http://localhost` on your laptop. Use `http://<EC2_PUBLIC_IP>/` or your domain. Also confirm port 80 is open in the security group.
- **`502 Bad Gateway` from Nginx**: The Holocron service is down or still starting. Check `sudo systemctl status holocron` and logs with `sudo journalctl -u holocron -n 200 --no-pager`.
- **`Next.js build worker exited` / SIGKILL**: Out-of-memory during `npm run build`. Add swap (2G) and rebuild.
- **`npm ERR! ERESOLVE`**: Dependency resolution conflict. Ensure Node 20.11.1, use the repo lockfile (`npm ci`) and do not mix yarn/pnpm.
- **`npm ci` fails with EUSAGE**: Lockfile missing in the repo. Use `npm install` to generate it or pull the latest lockfile.
- **PayPal `invalid_client` (401)**: Wrong credentials or environment mismatch. For sandbox, set `PAYPAL_ENVIRONMENT=sandbox` and update both server and `NEXT_PUBLIC_` client ID, then `npm run build` and `sudo systemctl restart holocron`.
- **TLS handshake errors**: Cloudflare SSL mode mismatch. Use `Full (strict)` with an Origin Certificate or turn off proxy and use Let's Encrypt.

With these pieces in place, you can onboard admins, run morale events, and keep HostHub schedules current while the next tools come online.
