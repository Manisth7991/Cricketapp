# PlayLocal

Local sports tournament discovery and registration platform — find nearby cricket, football, kabaddi
(and more) tournaments, register your team, or host your own. Every tournament is verified by an admin
before it goes live.

> **No payments, no live scoring, no points tables** in the MVP. Entry fees are informational and are
> settled directly with organisers.

## Stack

| Layer    | Tech                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| Frontend | React 19 + TypeScript, Vite 8, React Router 8, TanStack Query 5, Tailwind CSS v4, RHF + zod  |
| Backend  | Node 20+, Express 5, TypeScript, Mongoose 9 (MongoDB Atlas), JWT (httpOnly cookie)           |
| Shared   | `@playlocal/shared` — zod schemas, constants, DTO types and business rules used by both apps |
| Images   | Cloudinary (or a local-disk driver for development)                                          |

```
PlayLocal/
├── shared/     zod schemas, types, constants, domain rules (single source of truth)
├── backend/    Express API — config/ controllers/ routes/ models/ middleware/ services/ utils/ scripts/
├── frontend/   React SPA — pages/ components/ layouts/ services/ hooks/ context/ utils/ lib/
└── README.md
```

## Quick start

Requirements: **Node 20.19+** (tested on Node 24), npm 10+.

```bash
npm install                                   # installs all workspaces

cp backend/.env.example backend/.env          # fill in MONGO_URI, JWT_SECRET, Cloudinary keys, ADMIN_PHONES
cp frontend/.env.example frontend/.env        # defaults work for local dev

npm run seed                                  # sports + admin accounts (from ADMIN_PHONES)
npm run seed -- --demo                        # optional: realistic demo users, teams and tournaments

npm run dev                                   # API on :5000, web on :5173 (Vite proxies /api)
```

Open http://localhost:5173 · admin console at http://localhost:5173/admin

**No MongoDB handy?** `npm run db:memory` starts a throw-away in-memory MongoDB and prints a `MONGO_URI`
you can paste into `backend/.env` (data is lost when it stops). For images without Cloudinary set
`STORAGE_DRIVER=local`.

**Logging in:** users sign in with their **mobile number + OTP**. In development
(`SMS_PROVIDER=console`) no SMS is sent — the code is printed in the backend terminal and shown on the
login screen. Demo users (after `seed -- --demo`): phones `9000000101` (organiser of several
tournaments), `9000000102`, `9000000103`, `9000000104`. **Admins log in the same way** — the numbers
listed in `ADMIN_PHONES` land on the admin console (`/admin`) after the OTP; everyone else is a user.

## Commands

| Command (root)                   | What it does                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                    | API + web in watch mode                                            |
| `npm run build`                  | Production build of API (`backend/dist`) and web (`frontend/dist`) |
| `npm run typecheck`              | TypeScript across all workspaces                                   |
| `npm run lint`                   | ESLint (flat config)                                               |
| `npm run format`                 | Prettier                                                           |
| `npm run seed`                   | Seed sports + admin (`-- --demo` for demo data)                    |
| `npm run sync-admins -w backend` | Sync admin roles with `ADMIN_PHONES` (also runs on server start)   |
| `npm run db:memory`              | Start an in-memory MongoDB for local hacking                       |

Production: `npm run build && npm run start -w backend`.

## Environment variables

Everything is configured through env vars and validated at startup (the API refuses to boot with a
clear list of problems). Never commit `.env` files.

### Backend (`backend/.env`)

| Variable                                                                                          | Default                            | Notes                                                                            |
| ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                        | `development`                      | `production` forces secure cookies and forbids the local storage driver          |
| `PORT`                                                                                            | `5000`                             |                                                                                  |
| `CLIENT_ORIGINS`                                                                                  | `http://localhost:5173`            | Comma-separated allowed browser origins (CORS)                                   |
| `TRUST_PROXY`                                                                                     | `0`                                | Set `1` behind a load balancer / reverse proxy                                   |
| `LOG_LEVEL`                                                                                       | `info`                             | pino level                                                                       |
| `MONGO_URI`                                                                                       | — **required**                     | MongoDB Atlas connection string                                                  |
| `MONGO_AUTO_INDEX`                                                                                | `true`                             | Build indexes on boot                                                            |
| `JWT_SECRET`                                                                                      | — **required**                     | ≥ 32 random characters                                                           |
| `JWT_EXPIRES_IN`                                                                                  | `7d`                               |                                                                                  |
| `BCRYPT_ROUNDS`                                                                                   | `12`                               |                                                                                  |
| `COOKIE_NAME` / `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN`                             | `pl_session` / `false` / `lax` / — | Use `SAMESITE=none` + `SECURE=true` when web and API are on different sites      |
| `STORAGE_DRIVER`                                                                                  | `cloudinary`                       | `cloudinary` or `local` (dev only)                                               |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`                                              | —                                  | Required for the Cloudinary driver                                               |
| `CLOUDINARY_FOLDER`                                                                               | `playlocal`                        |                                                                                  |
| `PUBLIC_API_URL`                                                                                  | `http://localhost:5000`            | Used for local upload URLs + CSP                                                 |
| `UPLOAD_DIR`                                                                                      | `uploads`                          | Local driver folder                                                              |
| `CLIENT_DIST_DIR`                                                                                 | —                                  | Serve the built SPA from the API (single-server deploy), e.g. `../frontend/dist` |
| `APP_UTC_OFFSET`                                                                                  | `+05:30`                           | Timezone used to interpret tournament dates                                      |
| `GEOCODING_ENABLED` / `GEOCODER_URL` / `GEOCODER_USER_AGENT`                                      | `false` / Nominatim / —            | Optional address → coordinates for "nearest" sorting                             |
| `RATE_LIMIT_*`                                                                                    | see example                        | Window + per-route limits (auth, reports, uploads, global)                       |
| `SMS_PROVIDER`                                                                                    | `console`                          | `console` (dev: OTP printed in log, refused in production), `msg91` or `twilio`  |
| `OTP_TTL_SECONDS` / `OTP_RESEND_COOLDOWN_SECONDS` / `OTP_MAX_ATTEMPTS` / `OTP_MAX_SENDS_PER_HOUR` | `300` / `30` / `5` / `5`           | OTP lifetime, resend wait, wrong-code limit, per-number hourly cap               |
| `RATE_LIMIT_OTP_MAX`                                                                              | `10`                               | OTP requests per IP per window (SMS-pumping defence)                             |
| `MSG91_AUTH_KEY` / `MSG91_TEMPLATE_ID`                                                            | —                                  | MSG91 OTP API; template must be DLT-approved and contain `##OTP##`               |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`      | —                                  | Twilio Messages API                                                              |
| `ADMIN_PHONES` / `ADMIN_NAME`                                                                     | — (required in production)         | Comma-separated mobile numbers that own the admin console; synced on every start |
| `ADMIN_JWT_EXPIRES_IN`                                                                            | `1d`                               | Admin session lifetime (users: `JWT_EXPIRES_IN`, `7d`)                           |

### Frontend (`frontend/.env`)

| Variable                                              | Default                          | Notes                                            |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| `VITE_API_URL`                                        | `/api`                           | Full URL when the API is on another domain       |
| `VITE_DEV_API_PROXY`                                  | `http://localhost:5000`          | Dev proxy target                                 |
| `VITE_APP_NAME`                                       | `PlayLocal`                      |                                                  |
| `VITE_APP_TIMEZONE` / `VITE_LOCALE` / `VITE_CURRENCY` | `Asia/Kolkata` / `en-IN` / `INR` | Display formatting                               |
| `VITE_NOTIFICATION_POLL_MS`                           | `60000`                          | Unread-count polling (paused in background tabs) |

## Product rules (as implemented)

- **One account type.** Any user can play _and_ organise; organiser features appear on tournaments they own. Admin = a phone account whose number is in `ADMIN_PHONES` (synced on server start / `seed` / `sync-admins`) — the API never accepts a role from the client.
- **Login = phone OTP** (Indian mobile numbers). Same flow for login and sign-up: number → 6-digit OTP → (new numbers only) name + optional email. The verified number can't be changed from the profile. Admins use the exact same flow and are routed to `/admin`; there are no passwords anywhere.
- **Tournament lifecycle:** `draft → pending_verification → published → completed | cancelled`; `pending → rejected` (owner edits & resubmits); `published ↔ suspended` (admin). **Approval auto-publishes** with the Verified badge (`approved` exists in the enum for spec compatibility but is transitional).
- **Editing:** owners edit everything while `draft / pending_verification / rejected`. Once published only description, rules, banner, max teams (≥ registered) and waitlist can change.
- **Registration lifecycle:** `pending → confirmed` (organiser confirms) · `withdrawn` (captain, until the deadline) · `cancelled` (organiser declines / tournament cancelled) · `waitlisted` when full and the waitlist is enabled. Freed slots promote the oldest waitlisted team automatically (FIFO) with notifications.
- **Capacity is enforced atomically** (conditional `$inc`), so concurrent registrations can never overbook. Duplicate registration of the same team is blocked by a unique index.
- **Location:** users pick state + village/city; optional GPS enables distance display and "nearest first" sorting via a `2dsphere` index.

## API

Base URL `/api`. Responses: `{ success: true, message?, data, meta? }` or
`{ success: false, message, code, errors: [{ path, message }] }`. State-changing requests must send
`X-Requested-With: XMLHttpRequest` (CSRF defence) — the frontend client does this automatically.

| Method & path                                                                                                               | Auth        | Purpose                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                                                                               | –           | Liveness + DB status                                                                                      |
| `POST /auth/otp/request` `{ phone }`                                                                                        | –           | Send a 6-digit OTP (cooldown, hourly cap, per-IP limit; `devCode` returned only in dev console mode)      |
| `POST /auth/otp/verify` `{ phone, code }`                                                                                   | –           | Existing number → `{ status: 'logged_in', user }` + cookie; new number → `{ status: 'new_user', ticket }` |
| `POST /auth/otp/complete` `{ ticket, name, email? }`                                                                        | –           | Create the account for a verified number; sets httpOnly cookie                                            |
| `POST /auth/logout`                                                                                                         | –           | Clear the session cookie                                                                                  |
| `GET /auth/session` · `GET /auth/me` · `PATCH /auth/me`                                                                     | user        | Session & profile                                                                                         |
| `GET /sports`                                                                                                               | –           | Active sports                                                                                             |
| `GET /tournaments?search&sport&city&state&startDate&endDate&status&sort&lat&lng&radiusKm&page&limit`                        | –           | Public discovery (`status`: open/upcoming/closed/completed; `sort`: date/nearest/newest/prize)            |
| `GET /tournaments/:id`                                                                                                      | optional    | Details (non-public only for owner/admin)                                                                 |
| `POST /tournaments` · `PATCH /tournaments/:id` · `DELETE /tournaments/:id`                                                  | owner       | Create draft · edit · delete draft                                                                        |
| `POST /tournaments/:id/submit` · `/cancel` · `/complete`                                                                    | owner       | Lifecycle                                                                                                 |
| `POST /tournaments/:id/report`                                                                                              | user        | Report (rate-limited, one open report per user)                                                           |
| `POST /tournaments/:id/register`                                                                                            | captain     | Register a team (`{ teamId, note? }`)                                                                     |
| `GET /tournaments/:id/registrations`                                                                                        | owner/admin | Registrations with roster + captain contact                                                               |
| `GET /tournaments/:id/my-registrations`                                                                                     | user        | My registrations for one tournament                                                                       |
| `GET /me/tournaments?status` · `GET /me/registrations?status`                                                               | user        | My hosted tournaments · my registrations                                                                  |
| `PATCH /registrations/:id/withdraw`                                                                                         | captain     | Withdraw                                                                                                  |
| `POST /registrations/:id/confirm` · `/decline`                                                                              | owner/admin | Organiser decisions                                                                                       |
| `GET/POST /teams` · `GET/PATCH/DELETE /teams/:id`                                                                           | captain     | Teams                                                                                                     |
| `POST /teams/:id/players` · `PATCH/DELETE /teams/:id/players/:playerId`                                                     | captain     | Players                                                                                                   |
| `POST /uploads/image?kind=banner                                                                                            | logo        | avatar                                                                                                    | player` | user | Multipart `file` (JPG/PNG/WebP ≤ 2 MB, magic-byte checked) |
| `GET /notifications` · `GET /notifications/unread-count` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` | user        | In-app notifications                                                                                      |
| `GET /geo/reverse?lat&lng`                                                                                                  | –           | Optional reverse geocoding (rate-limited)                                                                 |
| `GET /admin/stats`                                                                                                          | admin       | Dashboard                                                                                                 |
| `GET /admin/tournaments?status&search` · `GET /admin/tournaments/pending` · `GET /admin/tournaments/:id`                    | admin       | Verification queue & detail                                                                               |
| `POST /admin/tournaments/:id/approve` · `/reject` (reason) · `/suspend` (reason) · `/reinstate`                             | admin       | Moderation                                                                                                |
| `GET /admin/users` · `PATCH /admin/users/:id/status`                                                                        | admin       | Block / unblock                                                                                           |
| `GET /admin/teams` · `GET /admin/reports` · `PATCH /admin/reports/:id`                                                      | admin       | Teams & reports                                                                                           |
| `GET/POST /admin/sports` · `PATCH /admin/sports/:id`                                                                        | admin       | Sport categories                                                                                          |

## Security

- Phone OTP: codes from a CSPRNG, stored only as an HMAC bound to the phone, single-use, 5-minute
  expiry, 5 wrong attempts max (counted atomically), 30 s resend cooldown, 5 SMS per number per hour,
  per-IP limit, Indian numbers only (blocks international SMS-pumping fraud). Signup tickets and
  session tokens are typed JWTs that can't be swapped. The console SMS provider is refused in production.
- No passwords anywhere. JWT in an **httpOnly** cookie (never readable by JS); admin sessions expire after
  `ADMIN_JWT_EXPIRES_IN` (1 day) vs 7 days for users. Role and blocked status are re-read from the DB on
  every request, so blocking or demoting takes effect immediately.
- Every input validated server-side with the shared zod schemas (unknown keys stripped); regex search input escaped.
- Ownership enforced in services (teams, tournaments, registrations); every `/admin` route behind `requireAdmin`.
- Helmet (incl. CSP), strict CORS allow-list, CSRF header check, rate limits on auth / reports / uploads / geo.
- Uploads: memory-only, size-limited, **magic-byte** type detection, and only images hosted on our own storage are accepted in records.
- No stack traces in production responses; consistent error codes.

## Performance

- Every page is a lazy route chunk; the admin console is never downloaded by regular users.
  Initial JS+CSS ≈ **133 KB gzipped** (axios replaced by a tiny fetch client).
- TanStack Query caching, `keepPreviousData` paging, debounced search, notification polling paused in background tabs.
- Cloudinary `f_auto,q_auto` + responsive `srcset`, lazy images with reserved aspect-ratio (CLS 0).
- Lean Mongo queries with projections, compound indexes for every discovery filter, denormalised counters,
  `$geoNear` with `$facet` for "nearest" pagination, short public caching + ETag + Brotli/gzip.
- Lighthouse (mobile, production build): Accessibility 100 · Best Practices 100 · SEO 100;
  throttled mobile trace: LCP ≈ 1.2 s, CLS 0.

## Deployment

**Option A – two services:** API on Render/Railway/Fly (`npm run build && npm run start -w backend`),
SPA on Vercel/Netlify/any static host from `frontend/dist` (configure an SPA rewrite to `index.html`).
Set `VITE_API_URL=https://api.example.com/api`, `CLIENT_ORIGINS=https://app.example.com`,
`COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `TRUST_PROXY=1`.

**Option B – single server:** set `CLIENT_DIST_DIR=../frontend/dist`; the API serves the SPA with
immutable caching for hashed assets and an SPA fallback. Keep `VITE_API_URL=/api`.

In Atlas, allow-list the API host IPs and create a DB user with read/write on the `playlocal` database.

## Known limitations

- Search is a case-insensitive substring match (fine for MVP scale). Upgrade path: MongoDB Atlas Search.
- "Nearest first" only includes venues with coordinates — set them in the create flow ("Use my current
  location") or enable `GEOCODING_ENABLED` to geocode addresses on submission.
- Notifications are in-app only (polling, no push/SMS/email yet).
- Real OTP SMS needs an SMS provider account (`SMS_PROVIDER=msg91` or `twilio`). For India, the sender ID and
  OTP template must be registered on DLT (done in the provider's dashboard). The MSG91/Twilio adapters are
  tested against their documented request formats, not against live accounts.
- Published tournaments are not auto-marked completed; organisers mark them (they drop out of the default
  discovery list automatically once the end date passes).
- Withdrawals close at the registration deadline; after that, captains contact the organiser.

## Future

Android/iOS apps, payments, live scoring, player stats, sponsorships, advanced brackets.
