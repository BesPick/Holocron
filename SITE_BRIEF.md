# BESPIN Holocron Site Brief

## Brief (5Ws)

- Who: BESPIN staff and admins who need internal morale, scheduling, and utility tools.
- What: A single Next.js tool suite that hosts Morale and HostHub modules behind one login.
- When: Used continuously for day-to-day announcements, scheduling, and internal workflows.
- Where: Accessed in a browser(mobile compatible); hosted as a single web app (EC2 + Nginx, currently fronted by Cloudflare).
- Why: Centralize internal tools, provide easier access to information, and keep auth/data/UX consistent.

## Writeup

### Purpose

BESPIN Holocron is an internal operations suite that consolidates multiple tools into one app. It prioritizes focused workflows over generic dashboards and keeps authentication, navigation, and data storage consistent across modules. This reduces maintenance overhead and improves team usability.

### Architecture (High-Level)

- Next.js App Router provides the UI shell and route-level module structure.
- Server Actions and API routes handle mutations and queries.
- Drizzle ORM reads/writes to a local SQLite database file.
- Clerk manages authentication, sessions, and user metadata (roles, group, portfolio, rank).
- Optional PayPal integration powers Boost contributions.
- Server-Sent Events (SSE) stream live updates for morale content.

### Data Flows and PPS (Personal Data Processing + Storage)

- Auth flow: Browser -> Clerk login -> session -> Next.js server reads Clerk user metadata for access control and personalization.
- App data flow: Browser -> Next.js API/Server Actions -> Drizzle -> SQLite; SSE pushes live updates to clients.
- Scheduling flow: Server services compute assignments -> stored in SQLite -> surfaced in HostHub views.
- Payments: Browser loads PayPal JS SDK -> PayPal handles payment details -> app receives payment status for display and recordkeeping as needed.
- Storage points:
  - SQLite: announcements, votes, schedules, uploads metadata, and other app data.
  - Clerk: user identity and role metadata.
  - Public uploads: persisted in `public/uploads` and referenced in SQLite.

### Why Host This Site

- Central hub for internal operations reduces context switching and tool sprawl.
- Shared auth and data minimize duplicated integrations and ongoing maintenance.
- Single deployment streamlines updates and enables consistent security controls.

### Risks and Mitigations

- Risk: Unauthorized access or role escalation.
  - Mitigation: Clerk auth, role checks on admin routes, and domain restrictions.
- Risk: Exposure of internal announcements, schedules, or PII.
  - Mitigation: Auth gating for tools, least-privilege role checks, TLS, and restricted origins.
- Risk: Payment fraud or misconfiguration when Boost is enabled.
  - Mitigation: PayPal handles card data, use sandbox during testing, and validate payment status server-side.
- Risk: Data loss or corruption in SQLite.
  - Mitigation: Routine backups, controlled deployments, and monitoring of DB integrity.
- Risk: Availability issues (single instance, no failover).
  - Mitigation: Health checks, restart policies (systemd), and optionally Cloudflare in front of Nginx.
- Risk: Secret leakage or misconfigured environment variables.
  - Mitigation: Keep secrets in `.env` only on the server, restrict file access, and rotate keys as needed.
