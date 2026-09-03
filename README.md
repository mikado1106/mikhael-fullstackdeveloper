# IndoKerja Job Application Management

A small full-stack web app that simulates the job application flow on IndoKerja.id.
Job seekers browse vacancies and apply; companies post vacancies, review candidates,
and move them through a hiring pipeline. Every status change is recorded in an
application history.

Built for the IndoKerja.id Full Stack Developer technical assessment.

## Live demo

| Part     | URL                                   |
| -------- | ------------------------------------- |
| Frontend | _to be filled after deployment_       |
| API      | _to be filled after deployment_       |

The API is a serverless function, so the first request after an idle period spends a
couple of seconds starting the container. Everything after that is immediate.

Anyone can browse jobs without an account; logging in is only needed to apply or to
manage postings.

### Demo accounts

All demo accounts use the password `password123`.

| Role       | Email                   | Notes                                   |
| ---------- | ----------------------- | --------------------------------------- |
| Company    | `company@indokerja.id`  | PT Nusantara Teknologi, 4 jobs posted   |
| Company    | `company2@indokerja.id` | Bumi Digital Studio, 3 jobs posted      |
| Job seeker | `seeker@indokerja.id`   | Has 2 applications in progress          |
| Job seeker | `seeker2@indokerja.id`  | Has 2 applications, one shortlisted     |

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
to `indokerja`.

### 2. Backend

```bash
cd backend
cp .env.example .env        # Windows CMD: copy .env.example .env
npm install                 # also runs `prisma generate`
npm run prisma:deploy       # creates the schema from the committed migration
npm run prisma:seed         # loads the demo accounts and jobs
npm run start:dev           # http://localhost:3000/api
```

The defaults in `.env.example` already match `docker-compose.yml`, so no editing is
needed for a local run.

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
no-op changes are rejected).

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
