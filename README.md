# BESPIN Holocron

BESPIN Holocron is BESPIN's internal operations suite: a single Next.js app that hosts multiple tools behind one shared shell. The vision is to build focused modules (morale, host operations, games) without fragmenting auth, data, or UX.

## Table of Contents

1. [Vision](#vision)
2. [Tool Suite](#tool-suite)
3. [Tech Stack](#tech-stack)
4. [Architecture & Data Flow](#architecture--data-flow)
5. [Developer Notes](#developer-notes)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [Directory Layout](#directory-layout)
9. [Authentication & Roles](#authentication--roles)
10. [Deployment Notes](#deployment-notes)

---

## Vision

- A modular tool hub that keeps navigation, auth, and data consistent across all tools.
- Fast internal workflows over generic dashboards; each tool is a focused control panel.
- Lightweight infra: SQLite + Clerk metadata instead of heavyweight services.
- A shared foundation that lets new tools ship quickly without rewriting plumbing.

## Tool Suite

### Morale (Live)

- Announcements, polls, and voting events with scheduling, auto-archive, and auto-delete.
- Polls support multi-select, anonymous mode, and admin-only voter breakdowns.
- Voting events support per-vote pricing and leaderboard modes driven by group/portfolio metadata.
- Boost contributions via PayPal checkout.
- Admin workflows: create/edit, scheduled queue, roster/role management.

### HostHub (Active + In Development)

- Personal schedule view for upcoming standup and Demo Day assignments.
- Calendar view for upcoming assignments across the roster.
- Docs hub embedding the standup schedule, "About Me" guidance, and Demo Day docs.
- Demo Day history export (CSV download).
- Admin scheduling settings UI is in development.

HostHub assignment rules (current):

- Standup shifts auto-assign for Mondays and Thursdays.
- Demo Day auto-assigns the first Wednesday of each month.
- Eligibility is derived from Clerk publicMetadata (rankCategory + rank).

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
- Persistent uploads live in `public/uploads` and are tracked in the `uploads` table.

## Developer Notes

- The app lives in `bespick/` (this README sits at the repo root).
- SQLite database file is created at `bespick/data/bespick.sqlite` on first run.
- HostHub schedule rules and Google Docs links live in `src/server/services/hosthub-schedule.ts` and `src/lib/hosthub-docs.ts`.
- Database tables of note: `announcements`, `poll_votes`, `uploads`, `demo_day_assignments`, `standup_assignments`.
- Clerk `publicMetadata` fields in use today: `role`, `group`, `portfolio`, `rankCategory`, `rank`.
- `publishDue` is invoked by the Morale dashboard to auto-publish, archive, and delete scheduled items.
- If you change Node versions, run `npm rebuild better-sqlite3` to refresh the native module.
- Tests run with `npm run test` (Vitest). Lint with `npm run lint`.

## Getting Started

### Prerequisites

- Node.js 20.11.1 (pinned in `bespick/.nvmrc` and `bespick/package.json` `engines`).
- npm 9+ (or pnpm/bun/yarn if you prefer).
- Clerk application (publishable + secret keys).
- Optional: PayPal REST app if you want Boost contributions enabled.

### Installation

```bash
git clone <repo-url>
cd bespick
npm install
```

### Quick setup checklist

1. Copy `bespick/.env.example` to `bespick/.env.local`.
2. Run `nvm use` (or ensure Node 20.11.1 is active).
3. Add the minimum secrets: Clerk publishable + secret keys, plus PayPal client credentials if you plan to use Boost.
4. Run `npm run dev` to boot the Next.js app. The SQLite database is created at `bespick/data/bespick.sqlite` on first run.
5. Visit `http://localhost:3000` to see the Holocron hub; Morale lives at `/dashboard`, HostHub at `/hosthub`.
6. Leave `PAYPAL_ENVIRONMENT=sandbox` until you have verified the full checkout flow with sandbox buyer accounts, then switch to `live`.
7. Optionally run `npm run lint` and `npm run test` before opening a PR.

## Environment Variables

Duplicate `bespick/.env.example` to `bespick/.env.local` and populate:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend key from your Clerk instance. |
| `CLERK_SECRET_KEY` | Server-side Clerk secret. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` / `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Routes for auth flows (defaults already match `/sign-*`). |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client ID from your PayPal REST app (sandbox or live). Used in the browser to load the PayPal JS SDK. |
| `NEXT_PUBLIC_PAYPAL_CURRENCY` | Optional currency override for the PayPal JS SDK (defaults to `USD`). |
| `PAYPAL_CLIENT_ID` | Same PayPal client ID, used server-side when exchanging OAuth tokens. |
| `PAYPAL_CLIENT_SECRET` | PayPal secret used on the server to request OAuth tokens. |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `live` to control which PayPal base URL is used. |
| `PAYPAL_BRAND_NAME` | Friendly brand label shown during PayPal checkout (defaults to `BESPIN Morale`). |
| `PAYPAL_API_BASE_URL` | Optional override if PayPal gives you a regional API domain. |

> The PayPal client ID appears twice on purpose: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is safe to expose to the browser to bootstrap the PayPal JS SDK, while `PAYPAL_CLIENT_ID` stays on the server (together with `PAYPAL_CLIENT_SECRET`) so we can exchange OAuth tokens without leaking secrets.

## Directory Layout

```text
bespick/
├─ data/                  # SQLite database file (created on first run)
├─ src/
│  ├─ app/                # Next.js App Router routes
│  │  ├─ (landing)/       # Holocron landing page
│  │  ├─ (tools)/
│  │  │  ├─ (morale)/     # Morale tool routes
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

- **Clerk middleware** (`src/proxy.ts`) forces authentication for every route except `/sign-in` and `/sign-up`, and blocks `/admin/*` unless `sessionClaims.metadata.role === 'admin'`.
- **Role values** are defined in `src/types/globals.d.ts` (`'admin' | ''`). Only admins currently unlock admin routes.
- **Granting roles** can be done via `/admin/roster` (which uses the `updateUserRole` server action) or directly in the Clerk dashboard by editing a user's `publicMetadata.role`.
- **Group, portfolio, and rank** metadata live in `publicMetadata` and power voting and HostHub eligibility.
- **Server enforcement**: mutations call `src/server/auth` helpers to ensure the user is logged in. Client routes rely on Clerk hooks (`useUser`) for conditional rendering.

## Deployment Notes

- **Next.js**: Deploy on Vercel (recommended) or any Node-compatible host. Ensure build environment has the same environment variables listed above.
- **Clerk**: Configure production URLs for sign-in/sign-up. Copy the live publishable + secret keys into your production environment.
- **SQLite storage**: Persist `data/` and `public/uploads` if your host wipes the filesystem on deploy. Use a mounted volume for Docker or a persistent disk on VMs.
- **Node version**: Use Node 20.11.1 in production to avoid native module mismatches with `better-sqlite3`.
- **Automation**: In production, keep the dashboard (or a scheduled job) calling `announcements.publishDue` so scheduled posts, auto-deletes, and auto-archives stay accurate. A simple approach is to configure a Vercel Cron task that hits a lightweight API route invoking the mutation at a fixed cadence.

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
- **TLS handshake errors**: Cloudflare SSL mode mismatch. Use `Full (strict)` with an Origin Certificate or turn off proxy and use Let’s Encrypt.

With these pieces in place, you can onboard admins, run morale events, and keep HostHub schedules current while the next tools come online.
