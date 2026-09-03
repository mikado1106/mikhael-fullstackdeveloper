# IndoKerja API

Base URL (local): `http://localhost:3000/api`

All responses are JSON. Timestamps are ISO 8601 strings. IDs are UUIDs.

## Authentication

Register or log in to receive an `accessToken`, then send it on every other request:

```
Authorization: Bearer <accessToken>
```

Tokens expire after 24 hours by default. Requests without a valid token receive `401`,
except on the endpoints marked public below.

Job listings (`GET /jobs`, `GET /jobs/:id`) are public. Sending a valid token is
optional; a job seeker's token adds `myApplication` to the job detail.

## Roles

| Role         | Can do                                                             |
| ------------ | ------------------------------------------------------------------ |
| `JOB_SEEKER` | Browse jobs, apply, see own applications and their history         |
| `COMPANY`    | Browse jobs, post jobs, see candidates of own jobs, change statuses |

Calling an endpoint with the wrong role returns `403`.

## Enums

| Enum                | Values                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `Role`              | `JOB_SEEKER`, `COMPANY`                                             |
| `JobType`           | `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, `FREELANCE`     |
| `ApplicationStatus` | `APPLIED`, `REVIEWING`, `SHORTLISTED`, `REJECTED`, `ACCEPTED`       |

## Error format

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["email must be an email"] }
```

`message` is a string, or an array of strings for validation errors.

| Status | Meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| 400    | Validation failed, unknown field sent, or business rule violated     |
| 401    | Missing or invalid token, or wrong credentials on login              |
| 403    | Wrong role, or trying to access another company's / user's resources |
| 404    | Resource not found                                                   |
| 409    | Duplicate (email already registered, already applied, concurrent status change) |

---

## Health

### `GET /health` (public)

```json
{ "status": "ok", "timestamp": "2026-09-03T00:00:00.000Z" }
```

---

## Auth

### `POST /auth/register` (public)

Request:

```json
{
  "email": "jane@example.com",
  "password": "password123",
  "name": "Jane Doe",
  "role": "COMPANY",
  "companyName": "Acme Corp",
  "companyLocation": "Jakarta",
  "companyDescription": "Optional"
}
```

`companyName` is required when `role` is `COMPANY` and ignored otherwise. Password must
be at least 8 characters.

Response `201`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": {
    "id": "...",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "role": "COMPANY",
    "company": { "id": "...", "name": "Acme Corp", "location": "Jakarta", "description": null },
    "createdAt": "..."
  }
}
```

Errors: `409` email already registered.

### `POST /auth/login` (public)

Request:

```json
{ "email": "company@indokerja.id", "password": "password123" }
```

Response `200`: same shape as register. Errors: `401` invalid email or password.

### `GET /auth/me`

Returns the `user` object for the current token.

---

## Jobs

### `GET /jobs` (public, token optional)

Lists active jobs, newest first.

| Query      | Type      | Description                                        |
| ---------- | --------- | -------------------------------------------------- |
| `page`     | number    | Default `1`                                        |
| `limit`    | number    | Default `10`, max `50`                             |
| `search`   | string    | Case-insensitive match on job title or company name |
| `jobType`  | `JobType` | Filter by type                                     |
| `location` | string    | Case-insensitive contains                          |

Response `200`:

```json
{
  "data": [
    {
      "id": "...",
      "title": "Frontend Developer (React)",
      "location": "Jakarta",
      "salaryMin": 8000000,
      "salaryMax": 12000000,
      "jobType": "FULL_TIME",
      "isActive": true,
      "createdAt": "...",
      "company": { "id": "...", "name": "PT Nusantara Teknologi", "location": "Jakarta" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 7, "totalPages": 1 }
}
```

### `GET /jobs/:id` (public, token optional)

Job detail including the description, company profile, applicant count and, for job
seekers, their own application to this job if any.

```json
{
  "id": "...",
  "companyId": "...",
  "title": "...",
  "description": "...",
  "location": "...",
  "salaryMin": 8000000,
  "salaryMax": 12000000,
  "jobType": "FULL_TIME",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "...",
  "company": { "id": "...", "name": "...", "location": "...", "description": "..." },
  "applicationsCount": 2,
  "myApplication": { "id": "...", "status": "REVIEWING", "createdAt": "..." }
}
```

`myApplication` is `null` when the seeker has not applied, and always `null` for
company users.

### `POST /jobs` (COMPANY)

Request:

```json
{
  "title": "Backend Engineer",
  "description": "At least 10 characters",
  "location": "Jakarta",
  "salaryMin": 10000000,
  "salaryMax": 15000000,
  "jobType": "FULL_TIME"
}
```

Response `201`: the created job with its `company`. Errors: `400` when
`salaryMax < salaryMin` or validation fails.

### `GET /companies/me/jobs` (COMPANY)

Jobs posted by the current company, newest first, each with `applicationsCount`.

---

## Applications

### `POST /jobs/:jobId/applications` (JOB_SEEKER)

Apply to a job. Body is optional:

```json
{ "coverLetter": "Optional, up to 2000 characters" }
```

Response `201`: the application detail (see below) with a single `APPLIED` history
entry.

Errors: `404` job not found, `400` job no longer active, `409` already applied.

### `GET /jobs/:jobId/applications` (COMPANY, owner only)

Candidates for one of the company's jobs, newest first.

```json
{
  "job": { "id": "...", "title": "Frontend Developer (React)" },
  "data": [
    {
      "id": "...",
      "jobId": "...",
      "applicantId": "...",
      "status": "SHORTLISTED",
      "coverLetter": "...",
      "createdAt": "...",
      "updatedAt": "...",
      "applicant": { "id": "...", "name": "Sari Lestari", "email": "seeker2@indokerja.id" }
    }
  ]
}
```

Errors: `403` when the job belongs to another company.

### `GET /applications/me` (JOB_SEEKER)

The current seeker's applications, newest first, each with a `job` summary:

```json
[
  {
    "id": "...",
    "jobId": "...",
    "applicantId": "...",
    "status": "REVIEWING",
    "coverLetter": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "job": {
      "id": "...",
      "title": "...",
      "location": "...",
      "jobType": "FULL_TIME",
      "salaryMin": 8000000,
      "salaryMax": 12000000,
      "companyId": "...",
      "company": { "id": "...", "name": "..." }
    }
  }
]
```

### `GET /applications/:id`

Full application detail with the status history. Accessible by the applicant and by the
company that owns the job; anyone else gets `403`.

```json
{
  "id": "...",
  "jobId": "...",
  "applicantId": "...",
  "status": "REVIEWING",
  "coverLetter": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "job": { "...same shape as GET /applications/me..." },
  "applicant": { "id": "...", "name": "...", "email": "..." },
  "history": [
    {
      "id": "...",
      "fromStatus": null,
      "toStatus": "APPLIED",
      "note": "Application submitted",
      "createdAt": "...",
      "changedBy": { "id": "...", "name": "Andi Pratama", "role": "JOB_SEEKER" }
    },
    {
      "id": "...",
      "fromStatus": "APPLIED",
      "toStatus": "REVIEWING",
      "note": "CV looks promising, scheduling a call",
      "createdAt": "...",
      "changedBy": { "id": "...", "name": "Rina Wijaya", "role": "COMPANY" }
    }
  ]
}
```

### `PATCH /applications/:id/status` (COMPANY, owner only)

Request:

```json
{ "status": "SHORTLISTED", "note": "Optional, up to 500 characters" }
```

Response `200`: the updated application detail including the new history entry.

Rules:

- `REJECTED` and `ACCEPTED` are final: further changes return `400`.
- Changing to the current status returns `400`.
- Any other move between non-final statuses is allowed, including backwards.
- If another request changed the status in the meantime, the update returns `409`.

Errors: `403` job belongs to another company, `404` application not found.
