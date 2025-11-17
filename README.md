# BESPICK Dashboard

BESPICK is an internal communications hub for morale updates, announcements, and polls. Admins can schedule and automate posts, collect votes, and audit participation, while teammates view live and archived activities from a clean Next.js interface backed by Convex and Clerk.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Application Features](#application-features)
4. [Payments & PayPal](#payments--paypal)
5. [Architecture & Data Flow](#architecture--data-flow)
6. [Getting Started](#getting-started)
7. [Directory Layout](#directory-layout)
8. [Convex API Surface](#convex-api-surface)
9. [Authentication & Roles](#authentication--roles)
10. [Deployment Notes](#deployment-notes)
11. [Troubleshooting](#troubleshooting)

---

## Overview

- **Core concept**: Activities are either announcements or polls. Both can be scheduled, auto-archived, or auto-deleted. Polls may accept new options, limit selections, close automatically, and (optionally) remain anonymous.
- **Surfaces**:
  - `/dashboard` – blended feed of published activities with poll voting.
  - `/archive` – read-only history for archived items.
  - `/admin/create` – unified form for creating or editing announcements/polls.
  - `/admin/scheduled` – list of upcoming items waiting to be published.
  - `/admin/roster` – Clerk-backed role management for the admin team.
- **Data backend**: Convex stores activities (`announcements`) and individual ballots (`pollVotes`) and exposes typed queries/mutations that the client consumes through `convex/react`.

## Tech Stack

- **UI**: Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS utilities.
- **State & Data**: Convex (`convex/announcements.ts`) for all CRUD, scheduling, voting, and analytics logic.
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
- Validation is mirrored in Convex to ensure client/server parity.

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

- `/payments` is surfaced in the global nav and lets any signed-in teammate fund morale efforts through PayPal. The UI exposes three quick-pick tiers plus a custom amount (min $1, max $10k).
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
3. Restart `npm run dev` (or redeploy) so the Next.js runtime picks up the new secrets. Use sandbox buyer accounts to exercise the `/payments` flow before turning on live mode.

### Sandbox & live workflow

- **Create sandbox personas**: the PayPal developer console lets you spin up both a Business (merchant) sandbox account and Personal (buyer) sandbox accounts. Use the Business account’s REST credentials everywhere in `.env.local`, and sign in as the Personal “buyer” during checkout to avoid charges.
- **Flip environments intentionally**: when you are ready for production payments, set `PAYPAL_ENVIRONMENT=live` and replace both the public and server client IDs with the live credentials. All four PayPal variables (`NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE_URL` if used) must point to the same environment.
- **Verify captures**: after each sandbox transaction, visit the PayPal dashboard > Activity to confirm PayPal recorded the capture ID shown in our UI. This is the same value returned to `/api/paypal/capture-order`.

### Operational tips

- **Customize contribution tiers**: the preset card copy and dollar amounts live in `src/components/payments/paypal-checkout.tsx` (`FUNDING_TIERS`). Updating the array is enough to change the UI.
- **Surface references to admins**: the capture ID we save comes directly from PayPal. Use it when reconciling PayPal statements or refunding contributors from the PayPal dashboard.
- **Currency & branding**: `NEXT_PUBLIC_PAYPAL_CURRENCY` and `PAYPAL_BRAND_NAME` allow you to localize the PayPal widget without touching code—just tweak the env and redeploy.

## Architecture & Data Flow

```text"
Next.js (App Router)  <--convex/react-->  Convex Functions  <---> Convex Storage
         |                                      |
   Clerk Frontend                        Clerk JWT / Identity
```

- Client components call `useQuery`/`useMutation` with references from `convex/_generated/api`.
- Convex functions validate payloads with `convex/values` validators, enforce scheduling rules, and persist data to:
  - `announcements` table: titles, descriptions, timestamps, poll metadata, automation fields.
  - `pollVotes` table: per-user selections plus cached `userName` for admin reporting.
- Authentication:
  - Next.js middleware (`src/proxy.ts`) blocks `/admin/*` unless the Clerk session metadata role is `admin`.
  - Convex `ctx.auth.getUserIdentity()` ensures mutations like `votePoll`, `create`, `update`, `remove`, and `archive` are only called by authenticated users.
- UI state (dismissed headers, active poll modals, etc.) is stored client-side, often persisted to `localStorage`.

## Getting Started

### Prerequisites

- Node.js ≥ 18.18 (Next.js 16 requirement).
- npm 9+ (or pnpm/bun/yarn if you prefer).
- Clerk application (publishable + secret keys, JWT issuer).
- Convex deployment (either hosted or local `npx convex dev`).

### Installation

```bash
git clone <repo-url>
cd bespick
npm install
```

### Quick setup checklist

1. Copy `.env.example` to `.env.local`.
2. Grab the minimum secrets: Clerk publishable + secret keys, your Convex deployment slug/URL, and both PayPal client credentials (one copy goes in the `NEXT_PUBLIC_*` variables, the other in the server-only variables alongside `PAYPAL_CLIENT_SECRET`).
3. Install dependencies with `npm install`.
4. Run `npx convex dev` in Terminal A so Convex generates types and exposes an API URL.
5. In Terminal B, run `npm run dev` to boot the Next.js app.
6. Visit `http://localhost:3000` and sign in via Clerk; admins can head straight to `/admin/create`, everyone else can test `/payments`.
7. Leave `PAYPAL_ENVIRONMENT=sandbox` until you have verified the full checkout flow with sandbox buyer accounts, then switch to `live`.
8. Optionally run `npm run lint` before opening a PR to catch obvious regressions.

### Environment Variables

Duplicate `.env.example` to `.env.local` and populate:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend key from your Clerk instance. |
| `CLERK_SECRET_KEY` | Server-side Clerk secret. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` / `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Routes for auth flows (defaults already match `/sign-*`). |
| `CLERK_JWT_ISSUER_DOMAIN` | Issuer domain for JWT templates (used by Convex). |
| `CONVEX_DEPLOYMENT` | Convex deployment identifier (e.g., `dev:my-team`). Required for CLI commands. |
| `NEXT_PUBLIC_CONVEX_URL` | Public endpoint of your Convex deployment (e.g., `https://<slug>.convex.site`). |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client ID from your PayPal REST app (sandbox or live). Used in the browser so the PayPal JS SDK can initialize. |
| `NEXT_PUBLIC_PAYPAL_CURRENCY` | Optional currency override for the PayPal JS SDK (defaults to `USD`). |
| `PAYPAL_CLIENT_ID` | Same PayPal client ID, used server-side when exchanging OAuth tokens. |
| `PAYPAL_CLIENT_SECRET` | PayPal secret used on the server to request OAuth tokens. |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `live` to control which PayPal base URL is used. |
| `PAYPAL_BRAND_NAME` | Friendly brand label shown during PayPal checkout (defaults to `BESPICK`). |
| `PAYPAL_API_BASE_URL` | Optional override if PayPal gives you a regional API domain. |

> The PayPal client ID appears twice on purpose: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is safe to expose to the browser to bootstrap the PayPal JS SDK, while `PAYPAL_CLIENT_ID` stays on the server (together with `PAYPAL_CLIENT_SECRET`) so we can exchange OAuth tokens without leaking secrets.

### Run the app locally

1. **Start Convex**  
   - Remote deployment: ensure `NEXT_PUBLIC_CONVEX_URL` points to it and you are logged in via `npx convex login`.  
   - Local deployment: run `npx convex dev` in a separate terminal; it prints a `CONVEX_URL` to use for `NEXT_PUBLIC_CONVEX_URL`.
2. **Boot Next.js**  

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`. Clerk-hosted auth pages will be proxied automatically.
3. **Optional linting/type checks**  

   ```bash
   npm run lint
   ```

### Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server with React Fast Refresh. |
| `npm run build` | Production build output in `.next`. |
| `npm run start` | Run the production build locally. |
| `npm run lint` | ESLint (includes React, TypeScript, and hook rules). |
| `npx convex dev` | Local Convex backend (also regenerates `convex/_generated/*`). |

## Directory Layout

```text"
bespick/
├─ convex/                # Convex schema + serverless functions
│  ├─ _generated/         # Auto-generated Convex client bindings
│  ├─ announcements.ts    # All queries/mutations for activities & votes
│  └─ schema.ts           # Data model definition
├─ src/
│  ├─ app/                # Next.js App Router routes
│  │  ├─ dashboard/       # Main feed
│  │  ├─ archive/         # Archive view
│  │  ├─ admin/           # Create, scheduled, roster pages
│  │  └─ payments/        # PayPal checkout + contribution tiers
│  ├─ components/         # Shared UI (forms, poll modal, headers, etc.)
│  ├─ server/             # Server actions (role updates, auth helpers, PayPal)
│  └─ types/              # Global TypeScript definitions
├─ public/                # Static assets
└─ README.md              # You are here
```

## Convex API Surface

| Function | Type | Purpose |
| --- | --- | --- |
| `announcements.create` | mutation | Create announcement/poll, validate scheduling + poll settings. |
| `announcements.update` | mutation | Edit existing activity with same validations. |
| `announcements.list` | query | Published feed filtered for dashboard. |
| `announcements.listArchived` | query | Archived activities. |
| `announcements.listScheduled` | query | Future publish queue for admins. |
| `announcements.get` | query | Fetch single activity (editing). |
| `announcements.getPoll` | query | Poll details for voters (options, totals, closures). |
| `announcements.getPollVoteBreakdown` | query | Admin-only per-option voter list. |
| `announcements.votePoll` | mutation | Cast or update a ballot; handles new options + validation. |
| `announcements.publishDue` | mutation | Promote due activities and enforce auto delete/archive. |
| `announcements.nextPublishAt` | query | Next scheduled publish timestamp (for timers). |
| `announcements.remove` | mutation | Delete an activity (and related votes). |
| `announcements.archive` | mutation | Mark an activity archived. |

Call signatures and generated hooks live in `convex/_generated/api`. Regenerate after schema changes with `npx convex dev` or `npx convex codegen`.

## Authentication & Roles

- **Clerk middleware** (`src/proxy.ts`) forces authentication for every route except `/sign-in` and `/sign-up`, and blocks `/admin/*` unless `sessionClaims.metadata.role === 'admin'`.
- **Role values** are defined in `src/types/globals.d.ts` (`'admin' | 'moderator' | ''`). Only admins currently unlock admin routes.
- **Granting roles** can be done via `/admin/roster` (which uses the `updateUserRole` server action) or directly in the Clerk dashboard by editing a user’s `publicMetadata.role`.
- **Convex enforcement**: mutations call `ctx.auth.getUserIdentity()` and error if the user is not logged in. Client routes rely on Clerk hooks (`useUser`) for conditional rendering.

## Deployment Notes

- **Next.js**: Deploy on Vercel (recommended) or any Node-compatible host. Ensure build environment has the same environment variables listed above.
- **Convex**: Use `npx convex deploy` (or the Convex dashboard) to push functions/schema. Update `CONVEX_DEPLOYMENT` to the production identifier and `NEXT_PUBLIC_CONVEX_URL` to the production endpoint.
- **Clerk**: Configure production URLs for sign-in/sign-up. Copy the live publishable + secret keys into your production environment.
- **Automation**: In production, keep the dashboard (or a scheduled job) calling `announcements.publishDue` so scheduled posts, auto-deletes, and auto-archives stay accurate. A simple approach is to configure a Vercel Cron task that hits a lightweight API route invoking the mutation at a fixed cadence.

## Troubleshooting

### Tailwind compiler: “Missing field `negated` on ScannerOptions.sources”

This usually happens when `tailwindcss` and `@tailwindcss/postcss` are on mismatched versions. Align them so the scanner and compiler agree:

```bash
npm install -D tailwindcss@4.1.17 @tailwindcss/postcss@4.1.17
rm -rf .next
npm run dev
```

The error should disappear on the next compile. Keep the dependency versions in `package.json` in sync (the template pins both to `^4.1.17`) to avoid the regression resurfacing after a fresh install.

With these pieces in place, you can onboard admins, schedule polls, and keep your team up to date through BESPICK. Contributions and refinements are welcome—open an issue or PR with your proposed improvements.
