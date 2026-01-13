# BESPIN Morale Dashboard

BESPIN Morale is an internal communications hub for morale updates, announcements, and polls. Admins can schedule and automate posts, collect votes, and audit participation, while teammates view live and archived activities from a clean Next.js interface backed by SQLite (Drizzle) and Clerk.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Application Features](#application-features)
4. [Payments & PayPal](#payments--paypal)
5. [Architecture & Data Flow](#architecture--data-flow)
6. [Getting Started](#getting-started)
7. [Directory Layout](#directory-layout)
8. [Authentication & Roles](#authentication--roles)
9. [Deployment Notes](#deployment-notes)

---

## Overview

- **Core concept**: Activities are either announcements or polls. Both can be scheduled, auto-archived, or auto-deleted. Polls may accept new options, limit selections, close automatically, and (optionally) remain anonymous.
- **Surfaces**:
  - `/dashboard` – blended feed of published activities with poll voting.
  - `/archive` – read-only history for archived items.
  - `/admin/create` – unified form for creating or editing announcements/polls.
  - `/admin/scheduled` – list of upcoming items waiting to be published.
  - `/admin/roster` – Clerk-backed role management for the admin team.
- **Data backend**: SQLite (via Drizzle) stores activities (`announcements`), ballots (`poll_votes`), and uploads. The database lives at `data/bespick.sqlite`.
- **Assignments**: Group + portfolio metadata live in Clerk `publicMetadata` and power voting leaderboards; admins can manage assignments in `/admin/roster`, and teammates can update their own group/portfolio from the profile dropdown.

## Tech Stack

- **UI**: Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS utilities.
- **State & Data**: Drizzle ORM + better-sqlite3 for CRUD, scheduling, voting, analytics, and uploads in `src/server/services`.
- **Auth**: Clerk for sign-in, session management, and role metadata.
- **Icons & UI polish**: `lucide-react`, `tailwind-merge`, `tailwind-variants`.
- **Tooling**: ESLint 9, TypeScript 5, PostCSS/Tailwind 4 pipeline.

## Application Features

### Activity Timeline & Archive

- Published announcements show titles, descriptions, publish/edited timestamps, and optional auto-delete/archive badges.
- Archive view filters to items whose status is `archived`.
- Scheduled view shows future posts with quick links to edit/delete before publication.

### Polling Engine

- Supports multi-select polls with configurable max selections.
- Optional anonymous mode hides aggregate results from non-admin voters.
- Admins can enable participant-submitted options; suggestions are deduplicated and added to the canonical option list.
- Polls can specify close dates/times; once closed or archived, votes become read-only.
- Results pane displays per-option counts and percentages.

### Admin Workspace

- Announcement form handles create and edit flows, including:
  - switching between announcement/poll/voting event types;
  - scheduling future publish times via human-friendly time-slot pickers;
  - auto-delete or auto-archive guards to prevent conflicts or invalid timestamps;
  - poll settings (anonymous, allow new options, selection limits, closing time).
- Validation is enforced in server services to keep business rules consistent.

### Automation & Background Tasks

- `publishDue` mutation promotes scheduled announcements whose `publishAt` has arrived.
- The dashboard periodically calls `publishDue` and refreshes `list`/`nextPublishAt` feeds; no separate cron job is required for local testing.
- Auto-delete and auto-archive enforcement happens inside the same mutation.

### Voting Insights

- Voters can revise their ballot until a poll closes; submissions are idempotent per user.
- Admins see an additional “View voter breakdown” toggle inside the poll modal. This surfaces every option with the list of users (name or fallback ID) who chose it, powered by the `getPollVoteBreakdown` query.

### Roster & Role Management

- `/admin/roster` lets admins search Clerk users, view their primary email, and promote/demote roles via the `updateUserRole` server action.
- Roles are persisted in `publicMetadata.role` and mirrored in JWT session claims for server protection.

## Payments & PayPal

- `/boost` is surfaced in the global nav and lets any signed-in teammate fund morale efforts through PayPal. The UI exposes three quick-pick tiers plus a custom amount (min $1, max $10k).
- The checkout experience uses `@paypal/react-paypal-js` with the PayPal JS SDK, so all sensitive card and PayPal credentials are handled by PayPal.
- API routes (`POST /api/paypal/create-order` and `/api/paypal/capture-order`) call into `src/server/payments/paypal.ts`, which wraps OAuth token exchange and order/capture requests with server-side environment variables.
- Status toasts report success, cancellation, or errors, and we store the PayPal capture ID so admins can reconcile with downstream reports if needed.

### Configuration

1. Create (or reuse) a PayPal REST app from the [developer dashboard](https://developer.paypal.com/dashboard/applications) and copy the client ID + secret for the sandbox or live environment.
2. Populate the new environment variables (see `.env.example`):  
   - `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (`sandbox` or `live` client ID shown in the PayPal dashboard).  
   - `NEXT_PUBLIC_PAYPAL_CURRENCY` (defaults to `USD`).  
   - `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` for the secure server-side calls.  
   - `PAYPAL_ENVIRONMENT` as `sandbox` or `live`. You can optionally override `PAYPAL_API_BASE_URL` if PayPal provisions a regional domain.  
   - `PAYPAL_BRAND_NAME` controls the label PayPal shows customers.
3. Restart `npm run dev` (or redeploy) so the Next.js runtime picks up the new secrets. Use sandbox buyer accounts to exercise the `/boost` flow before turning on live mode.

## Architecture & Data Flow

```text
Next.js (App Router)  <--- API Routes/Server Actions --->  SQLite (Drizzle)
         |
   Clerk Frontend
```

- Client components call `useApiQuery`/`useApiMutation`, which route through `src/app/api/rpc/route.ts` and `src/server/actions`.
- Server services validate payloads, enforce scheduling rules, and persist data to:
  - `announcements` table: titles, descriptions, timestamps, poll metadata, automation fields.
  - `poll_votes` table: per-user selections plus cached `userName` for admin reporting.
  - `uploads` table: uploaded image filenames stored in `public/uploads`.
- Live refresh uses an SSE stream at `src/app/api/stream/route.ts`, consumed by `src/lib/liveEvents` to re-fetch data on changes.
- Authentication:
  - Next.js middleware (`src/proxy.ts`) blocks `/admin/*` unless the Clerk session metadata role is `admin`.
  - Server actions use `src/server/auth` to ensure mutations are only called by signed-in users.
- UI state (dismissed headers, active poll modals, etc.) is stored client-side, often persisted to `localStorage`.

## Getting Started

### Prerequisites

- Node.js 20.11.1 (pinned in `.nvmrc` and `package.json` `engines`).
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

1. Copy `.env.example` to `.env.local`.
2. Run `nvm use` (or ensure Node 20.11.1 is active).
3. Grab the minimum secrets: Clerk publishable + secret keys, plus PayPal client credentials if you plan to use Boost (one copy goes in the `NEXT_PUBLIC_*` variables, the other in the server-only variables alongside `PAYPAL_CLIENT_SECRET`).
4. Run `npm run dev` to boot the Next.js app. The SQLite database is created at `data/bespick.sqlite` on first run.
5. Visit `http://localhost:3000` and sign in via Clerk; admins can head straight to `/admin/create`, everyone else can test `/boost`.
6. Leave `PAYPAL_ENVIRONMENT=sandbox` until you have verified the full checkout flow with sandbox buyer accounts, then switch to `live`.
7. Optionally run `npm run lint` before opening a PR to catch obvious regressions.

If you change Node versions, run `npm rebuild better-sqlite3` to rebuild the native module for the active runtime.

### Environment Variables

Duplicate `.env.example` to `.env.local` and populate:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend key from your Clerk instance. |
| `CLERK_SECRET_KEY` | Server-side Clerk secret. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` / `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Routes for auth flows (defaults already match `/sign-*`). |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client ID from your PayPal REST app (sandbox or live). Used in the browser so the PayPal JS SDK can initialize. |
| `NEXT_PUBLIC_PAYPAL_CURRENCY` | Optional currency override for the PayPal JS SDK (defaults to `USD`). |
| `PAYPAL_CLIENT_ID` | Same PayPal client ID, used server-side when exchanging OAuth tokens. |
| `PAYPAL_CLIENT_SECRET` | PayPal secret used on the server to request OAuth tokens. |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `live` to control which PayPal base URL is used. |
| `PAYPAL_BRAND_NAME` | Friendly brand label shown during PayPal checkout (defaults to `BESPIN Morale`). |
| `PAYPAL_API_BASE_URL` | Optional override if PayPal gives you a regional API domain. |

> The PayPal client ID appears twice on purpose: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is safe to expose to the browser to bootstrap the PayPal JS SDK, while `PAYPAL_CLIENT_ID` stays on the server (together with `PAYPAL_CLIENT_SECRET`) so we can exchange OAuth tokens without leaking secrets.

### Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server with React Fast Refresh. |
| `npm run build` | Production build output in `.next`. |
| `npm run start` | Run the production build locally. |
| `npm run lint` | ESLint (includes React, TypeScript, and hook rules). |

## Directory Layout

```text
bespick/
├─ data/                  # SQLite database file (created on first run)
├─ src/
│  ├─ app/                # Next.js App Router routes
│  │  ├─ dashboard/       # Main feed
│  │  ├─ archive/         # Archive view
│  │  ├─ admin/           # Create, scheduled, roster pages
│  │  └─ boost/           # PayPal checkout + contribution tiers
│  ├─ components/         # Shared UI (forms, poll modal, headers, etc.)
│  ├─ server/             # Server actions (role updates, auth helpers, PayPal)
│  └─ types/              # Global TypeScript definitions
├─ public/                # Static assets
│  └─ uploads/            # User-uploaded images (created at runtime)
└─ README.md              # You are here
```

## Authentication & Roles

- **Clerk middleware** (`src/proxy.ts`) forces authentication for every route except `/sign-in` and `/sign-up`, and blocks `/admin/*` unless `sessionClaims.metadata.role === 'admin'`.
- **Role values** are defined in `src/types/globals.d.ts` (`'admin' | ''`). Only admins currently unlock admin routes.
- **Granting roles** can be done via `/admin/roster` (which uses the `updateUserRole` server action) or directly in the Clerk dashboard by editing a user’s `publicMetadata.role`.
- **Group & portfolio** assignments live in `publicMetadata.group` and `publicMetadata.portfolio`. Users can update their own assignments from the profile dropdown; admins can edit any user in `/admin/roster`.
- **Server enforcement**: mutations call `src/server/auth` helpers to ensure the user is logged in. Client routes rely on Clerk hooks (`useUser`) for conditional rendering.

## Deployment Notes

- **Next.js**: Deploy on Vercel (recommended) or any Node-compatible host. Ensure build environment has the same environment variables listed above.
- **Clerk**: Configure production URLs for sign-in/sign-up. Copy the live publishable + secret keys into your production environment.
- **SQLite storage**: Persist `data/` and `public/uploads` if your host wipes the filesystem on deploy. Use a mounted volume for Docker or a persistent disk on VMs.
- **Node version**: Use Node 20.11.1 in production to avoid native module mismatches with `better-sqlite3`.
- **Automation**: In production, keep the dashboard (or a scheduled job) calling `announcements.publishDue` so scheduled posts, auto-deletes, and auto-archives stay accurate. A simple approach is to configure a Vercel Cron task that hits a lightweight API route invoking the mutation at a fixed cadence.

With these pieces in place, you can onboard admins, schedule polls, and keep your team up to date through BESPIN Morale. Contributions and refinements are welcome — open an issue or PR with your proposed improvements.
