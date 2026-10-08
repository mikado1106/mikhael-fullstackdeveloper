# LokerKita — Job Application Management

Job seekers browse vacancies, apply, and track every application. Companies post
vacancies, review candidates, and move them through a hiring pipeline where every
status change is recorded in an append-only history. Both sides see the same state —
no spreadsheets, no lost threads, no "sudah dibaca tapi tidak dibalas" limbo.

Built as a portfolio project by Mikhael Edo Sinambela.

## Why this exists

Applying for jobs through portals and chat threads scatters the process: seekers
lose track of where they applied and what stage each application is at; companies
juggle candidates across spreadsheets and inbox threads, and nobody can answer
"what's the latest?" with confidence. LokerKita puts both sides on one shared
record — the application plus its full status history — so that question always
has exactly one answer.

## Key technical decisions

- **The database enforces the invariants, not `if` statements.** One application
  per seeker per job is a unique constraint, so it holds under concurrent
  requests. Status changes are compare-and-set on the last-read status: if two
  reviewers act on the same candidate at once, the second gets a `409` instead of
  silently overwriting the first.
- **Applying is atomic.** The job row is locked (`SELECT ... FOR UPDATE`) before
  the active check, and the check plus the insert run in one transaction.
- **Auth is deny-by-default.** A global JWT guard means a new endpoint cannot be
  left open by accident; role guards and per-company ownership checks sit on top.
- **Login doesn't leak timing.** bcrypt always runs exactly once, even for
  unknown emails.
- **Trade-offs are documented, not hidden.** Register returns `409` for a taken
  email — it confirms the address exists, accepted because there is no mail
  infrastructure for an "already registered" notice. Rate limiting is in-memory
  per instance, which is weak on serverless; that's written down as a known
  limitation with a shared store as the next step.
- **Serverless without divergence.** One `bootstrap.ts` builds the app for both
  the long-running server and the Vercel function, so the API prefix, CORS, and
  validation rules cannot drift apart.

## October 2026 revamp

The project started as a technical assessment under a different brand. The revamp:

1. **Full rebrand** to LokerKita: new logo and teal identity, all copy, demo data,
   and documentation.
2. **Quality pass**: rate limiting on auth (10/min) and status mutations (30/min),
   JWT secret strength enforced in production, pagination on every list endpoint,
   transactional apply with row locking, and unit tests for the new rules. Every
   change passed an independent QA review before merge.
3. **On the roadmap**: email notifications on status changes and a company
   analytics dashboard — both cheap to add on this architecture, neither needs a
   breaking schema change.

## Live demo

| Part     | URL                                                |
| -------- | -------------------------------------------------- |
| Frontend | https://mikhael-fullstackdeveloper.vercel.app       |
| API      | https://indokerja-api.vercel.app/api                |

> Note: the live deployments still use the previous project names and will be
> re-deployed under LokerKita.

The API is a serverless function, so the first request after an idle period spends a
couple of seconds starting the container. Everything after that is immediate.

Anyone can browse jobs without an account; logging in is only needed to apply or to
manage postings.

### Demo accounts

All demo accounts use the password `password123`.

| Role       | Email                   | Notes                                   |
| ---------- | ----------------------- | --------------------------------------- |
| Company    | `company@lokerkita.id`  | PT Nusantara Teknologi, has candidates to review |
| Company    | `company2@lokerkita.id` | Bumi Digital Studio, a second company    |
| Job seeker | `seeker@lokerkita.id`   | Has 2 applications in progress          |
| Job seeker | `seeker2@lokerkita.id`  | Has 2 applications, one shortlisted     |

You can also register new accounts of either role from the app.

## Tech stack

| Layer      | Choice                                            |
| ---------- | ------------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend    | Node.js, TypeScript, NestJS 11                    |
| Database   | PostgreSQL with Prisma ORM                        |
| Auth       | JWT (Bearer token), bcrypt password hashing       |
| Validation | class-validator DTOs with a global ValidationPipe |

## Project structure

```
.
├── backend/               NestJS REST API
│   ├── api/               Vercel serverless entry point
│   ├── public/            Landing page shown at the API root
│   ├── prisma/
│   │   ├── schema.prisma  Database schema
│   │   ├── migrations/    Generated SQL migrations
│   │   └── seed.ts        Demo data
│   └── src/
│       ├── auth/          Register, login, JWT issuing
│       ├── common/        Guards, decorators, filters, shared DTOs
│       ├── companies/     Company ownership lookups
│       ├── jobs/          Job listing and posting
│       ├── applications/  Applying, candidate review, status history
│       └── prisma/        Prisma client provider
├── frontend/              React single-page app
│   └── src/
│       ├── api/           Typed API calls
│       ├── auth/          Auth context and route guards
│       ├── components/    Layout and UI primitives
│       ├── lib/           Fetch wrapper and formatters
│       ├── pages/         Screens for guests, seekers and companies
│       └── types/         Response types shared with the API
├── docs/API.md            API documentation
└── docker-compose.yml     Local PostgreSQL
```

## Running locally

Prerequisites: Node.js 22+, npm, and Docker (for the local PostgreSQL). Any other
PostgreSQL 14+ instance works too; just point `DATABASE_URL` at it.

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5432` with user, password, and database all set
to `lokerkita`. The volume is named `lokerkita_postgres_data`, so a fresh database is
initialized on first run — including for anyone who ran the pre-rebrand version (the
old `postgres_data` volume simply becomes an unused orphan; `docker volume prune`
reclaims the disk space).

### 2. Backend

```bash
cd backend
cp .env.example .env        # Windows CMD: copy .env.example .env
npm install                 # also runs `prisma generate`
npm run prisma:deploy       # creates the schema from the committed migration
npm run prisma:seed         # loads the demo accounts and jobs (see note below)
npm run start:dev           # http://localhost:3000/api
```

The defaults in `.env.example` already match `docker-compose.yml`, so no editing is
needed for a local run. Note: if the database was seeded before the rebrand, reset
it first (`npx prisma migrate reset`) — reseeding otherwise adds a second set of
demo accounts instead of replacing them.

Quick check: `GET http://localhost:3000/api/health` returns `{"status":"ok"}`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

In development, Vite proxies `/api` to the backend, so no extra configuration is needed.
To point the frontend at a different API, copy `.env.example` to `.env` and set
`VITE_API_URL`.

### Tests

```bash
cd backend
npm test
```

Unit tests cover the application status transition rules (final statuses are frozen,
no-op changes are rejected) and environment validation (required variables, JWT
secret strength in production, strict `NODE_ENV`).

## Environment variables

### Backend (`backend/.env`)

| Variable                 | Required | Description                                        |
| ------------------------ | -------- | -------------------------------------------------- |
| `DATABASE_URL`           | yes      | PostgreSQL connection string                       |
| `JWT_SECRET`             | yes      | Secret used to sign access tokens                  |
| `JWT_EXPIRES_IN_SECONDS` | no       | Token lifetime, default `86400` (1 day)            |
| `PORT`                   | no       | HTTP port, default `3000`                          |
| `CORS_ORIGIN`            | no       | Allowed origins, comma separated, default `http://localhost:5173` |

The app refuses to start when a required variable is missing.

### Frontend (`frontend/.env`)

| Variable       | Required | Description                                                    |
| -------------- | -------- | -------------------------------------------------------------- |
| `VITE_API_URL` | no       | Full API base URL including `/api`. Empty in dev (uses proxy). |

## Deployment

Everything runs on free tiers: Neon for the database, and two Vercel projects from
this one repository.

1. **Neon** (PostgreSQL): create a project in the Singapore region and copy the pooled
   connection string. Region matters: from Indonesia a Singapore database answers in
   about 20 ms, a US one in about 250 ms.
2. **Vercel** (API): import the repo with root directory `backend`.
   - Environment: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=<your frontend URL>`
   - `backend/vercel.json` builds with `nest build` and rewrites every `/api/*` request
     to a single serverless function. `api/index.js` hands the request to the compiled
     Nest app, which is booted once per warm container rather than once per request.
3. **Vercel** (frontend): import the repo again, this time with root directory
   `frontend`.
   - Environment: `VITE_API_URL=https://<your-api-deployment>/api`
   - `frontend/vercel.json` rewrites all routes to `index.html` for client-side routing.

Schema changes are applied with `npm run prisma:deploy` and demo data with
`npm run prisma:seed`, both run locally against the production `DATABASE_URL`. A
serverless function is not a good place to run migrations, so they stay a deliberate
step rather than something that happens on every deploy.

## Design notes

### Database

Five tables, all with UUID primary keys:

- `users` holds login accounts with a `role` of `JOB_SEEKER` or `COMPANY`.
- `companies` is a 1:1 profile for company users, so company data never lives in the
  users table and jobs have a clean relation to their company.
- `jobs` belong to a company. Salary is stored as an integer range in IDR per month.
- `applications` link a job seeker to a job. A unique constraint on
  `(jobId, applicantId)` enforces "one application per job" at the database level,
  which also holds under concurrent requests.
- `application_status_histories` is an append-only audit trail with the previous
  status, the new status, who changed it, an optional note, and a timestamp. The
  initial `APPLIED` entry is written together with the application.

The full schema is in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

### Pinned dependencies

`@nestjs/config` and `@nestjs/jwt` are pinned to their last CommonJS releases. The 12.x
line is ESM-only, which a CommonJS build can only load on Node 22.12 and newer. Pinning
keeps the app runnable on any supported Node version, including the one the serverless
platform happens to use. Upgrading them means moving the whole backend to ESM.

### Security

- Passwords are hashed with bcrypt (10 rounds) and never returned by the API.
- Every route requires a valid JWT unless explicitly marked public (register, login,
  health, and the read-only job listing endpoints). The guard is registered globally, so
  a new endpoint cannot accidentally be left open.
- Role guard: endpoints declare which role may call them (`@Roles(...)`).
- Ownership checks: a company can only list candidates and change statuses for jobs it
  owns; a job seeker can only see their own applications. Violations return `403`.
- All request bodies and query strings are validated against DTOs; unknown fields are
  rejected (`400`).
- Database errors such as unique violations are translated into proper HTTP responses
  (`409`) instead of leaking as `500`s.
- Rate limiting via `@nestjs/throttler`: 100 requests/minute per IP globally,
  10/min on `register`/`login`, 30/min on application status changes. Honest
  limitation: the store is in-memory, so on serverless each warm container counts
  separately — a shared store (e.g. Upstash Redis) is the documented next step if
  abuse ever becomes real rather than theoretical.
- `POST /auth/register` returns `409` for a taken email, which confirms the address
  exists. Deliberate trade-off: there is no mail infrastructure to send an
  "already registered" notice instead, and a vague error would only confuse
  legitimate signups.
- `JWT_SECRET` must be at least 32 characters long when `NODE_ENV=production`;
  the app refuses to start otherwise.

### Business rules

- A job seeker cannot apply twice to the same job (`409 Conflict`).
- Applying to an inactive job is rejected (`400`).
- Status changes are written together with their history entry in one transaction.
- `REJECTED` and `ACCEPTED` are final; further changes are rejected (`400`).
- Changing to the same status is rejected so the history never contains empty entries.
- A status update filters on the status that was just read (compare-and-set). If two
  reviewers change the same application at the same time, the second one gets a `409`
  instead of silently overwriting the first.

### Error format

```json
{ "statusCode": 409, "error": "Conflict", "message": "You have already applied to this job" }
```

Validation errors return `message` as an array of strings.

See [`docs/API.md`](docs/API.md) for the full endpoint reference.
