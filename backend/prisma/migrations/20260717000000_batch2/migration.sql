-- Baseline migration for small tables / a scheduled maintenance window.
-- For large production tables, provision the GIN indexes via a separately
-- coordinated concurrent-index rollout, outside any transaction.
-- pg_trgm must be supported and provisionable by the deployment database role.

BEGIN;

-- Abort with a report rather than silently repairing invalid salaries.
DO $$
DECLARE
  invalid_count BIGINT;
  sample_ids TEXT;
BEGIN
  SELECT COUNT(*)
  INTO invalid_count
  FROM "jobs"
  WHERE "salaryMin" < 0
     OR "salaryMax" < 0
     OR (
       "salaryMin" IS NOT NULL
       AND "salaryMax" IS NOT NULL
       AND "salaryMin" > "salaryMax"
     );

  IF invalid_count > 0 THEN
    SELECT string_agg(invalid."id", ', ' ORDER BY invalid."id")
    INTO sample_ids
    FROM (
      SELECT "id"
      FROM "jobs"
      WHERE "salaryMin" < 0
         OR "salaryMax" < 0
         OR (
           "salaryMin" IS NOT NULL
           AND "salaryMax" IS NOT NULL
           AND "salaryMin" > "salaryMax"
         )
      ORDER BY "id"
      LIMIT 20
    ) AS invalid;

    RAISE EXCEPTION
      'Salary audit failed: % invalid jobs; sample IDs: %. Obtain approval before correcting data.',
      invalid_count,
      sample_ids;
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "CvUploadStatus" AS ENUM (
  'PENDING',
  'VERIFYING',
  'FINALIZED',
  'FAILED',
  'EXPIRED',
  'SUPERSEDED'
);

ALTER TABLE "jobs"
  ALTER COLUMN "salaryMin" DROP NOT NULL,
  ALTER COLUMN "salaryMax" DROP NOT NULL,
  ADD CONSTRAINT "jobs_salary_min_nonnegative_check"
    CHECK ("salaryMin" IS NULL OR "salaryMin" >= 0),
  ADD CONSTRAINT "jobs_salary_max_nonnegative_check"
    CHECK ("salaryMax" IS NULL OR "salaryMax" >= 0),
  ADD CONSTRAINT "jobs_salary_range_check"
    CHECK (
      "salaryMin" IS NULL
      OR "salaryMax" IS NULL
      OR "salaryMin" <= "salaryMax"
    );

-- Prisma generates uuid() and @updatedAt values in the client, matching
-- the existing schema. IDs and updatedAt intentionally have no SQL default.
CREATE TABLE "saved_jobs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_jobs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_jobs_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "jobs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "cv_documents" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "latestIssued" BIGINT NOT NULL DEFAULT 0,
  "activeGeneration" BIGINT NOT NULL DEFAULT 0,
  "activeObjectPath" TEXT,
  "activeFileName" TEXT,
  "activeSizeBytes" INTEGER,
  "activeMimeType" TEXT,
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cv_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cv_documents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cv_documents_generation_check"
    CHECK (
      "activeGeneration" >= 0
      AND "activeGeneration" <= "latestIssued"
    ),
  CONSTRAINT "cv_documents_active_metadata_check"
    CHECK (
      (
        "activeGeneration" = 0
        AND "activeObjectPath" IS NULL
        AND "activeFileName" IS NULL
        AND "activeSizeBytes" IS NULL
        AND "activeMimeType" IS NULL
        AND "activatedAt" IS NULL
      )
      OR
      (
        "activeGeneration" > 0
        AND "activeObjectPath" IS NOT NULL
        AND "activeFileName" IS NOT NULL
        AND "activeSizeBytes" IS NOT NULL
        AND "activeMimeType" IS NOT NULL
        AND "activatedAt" IS NOT NULL
      )
    ),
  CONSTRAINT "cv_documents_active_size_check"
    CHECK (
      "activeSizeBytes" IS NULL
      OR "activeSizeBytes" BETWEEN 1 AND 5000000
    ),
  CONSTRAINT "cv_documents_active_mime_check"
    CHECK (
      "activeMimeType" IS NULL
      OR "activeMimeType" = 'application/pdf'
    )
);

CREATE TABLE "cv_upload_attempts" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "status" "CvUploadStatus" NOT NULL DEFAULT 'PENDING',
  "temporaryObjectPath" TEXT NOT NULL,
  "finalObjectPath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "declaredSizeBytes" INTEGER NOT NULL,
  "declaredMimeType" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "uploadCapabilityUntil" TIMESTAMP(3) NOT NULL,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cv_upload_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cv_upload_attempts_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "cv_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cv_upload_attempts_generation_check"
    CHECK ("generation" > 0),
  CONSTRAINT "cv_upload_attempts_declared_size_check"
    CHECK ("declaredSizeBytes" BETWEEN 1 AND 5000000),
  CONSTRAINT "cv_upload_attempts_declared_mime_check"
    CHECK ("declaredMimeType" = 'application/pdf'),
  CONSTRAINT "cv_upload_attempts_lease_check"
    CHECK (
      ("leaseToken" IS NULL AND "leaseUntil" IS NULL)
      OR
      ("leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
    )
);

-- No source FK: cleanup work must survive deletion of source metadata.
CREATE TABLE "storage_cleanup_tasks" (
  "id" TEXT NOT NULL,
  "objectPath" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "unneededAt" TIMESTAMP(3) NOT NULL,
  "notBefore" TIMESTAMP(3) NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "storage_cleanup_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storage_cleanup_tasks_attempts_check"
    CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "saved_jobs_userId_jobId_key"
  ON "saved_jobs"("userId", "jobId");
CREATE INDEX "saved_jobs_userId_createdAt_id_idx"
  ON "saved_jobs"("userId", "createdAt", "id");
CREATE INDEX "saved_jobs_jobId_idx"
  ON "saved_jobs"("jobId");

CREATE UNIQUE INDEX "cv_documents_userId_key"
  ON "cv_documents"("userId");
CREATE UNIQUE INDEX "cv_documents_activeObjectPath_key"
  ON "cv_documents"("activeObjectPath");

CREATE UNIQUE INDEX "cv_upload_attempts_temporaryObjectPath_key"
  ON "cv_upload_attempts"("temporaryObjectPath");
CREATE UNIQUE INDEX "cv_upload_attempts_finalObjectPath_key"
  ON "cv_upload_attempts"("finalObjectPath");
CREATE UNIQUE INDEX "cv_upload_attempts_documentId_generation_key"
  ON "cv_upload_attempts"("documentId", "generation");
CREATE INDEX "cv_upload_attempts_documentId_status_expiresAt_idx"
  ON "cv_upload_attempts"("documentId", "status", "expiresAt");
CREATE INDEX "cv_upload_attempts_status_expiresAt_idx"
  ON "cv_upload_attempts"("status", "expiresAt");
CREATE INDEX "cv_upload_attempts_status_leaseUntil_idx"
  ON "cv_upload_attempts"("status", "leaseUntil");

CREATE UNIQUE INDEX "storage_cleanup_tasks_objectPath_key"
  ON "storage_cleanup_tasks"("objectPath");
CREATE INDEX "storage_cleanup_tasks_completedAt_nextRunAt_idx"
  ON "storage_cleanup_tasks"("completedAt", "nextRunAt");

-- Keep jobs_isActive_createdAt_idx until existing query plans are audited.
CREATE INDEX "jobs_isActive_createdAt_id_idx"
  ON "jobs"("isActive", "createdAt", "id");

CREATE INDEX "application_status_histories_applicationId_createdAt_id_idx"
  ON "application_status_histories"("applicationId", "createdAt", "id");
DROP INDEX "application_status_histories_applicationId_createdAt_idx";

CREATE INDEX "jobs_title_trgm_idx"
  ON "jobs" USING gin ("title" gin_trgm_ops);
CREATE INDEX "jobs_description_trgm_idx"
  ON "jobs" USING gin ("description" gin_trgm_ops);
CREATE INDEX "jobs_location_trgm_idx"
  ON "jobs" USING gin ("location" gin_trgm_ops);
CREATE INDEX "companies_name_trgm_idx"
  ON "companies" USING gin ("name" gin_trgm_ops);

-- Before enabling F1, benchmark representative queries using EXPLAIN
-- (ANALYZE, BUFFERS), especially the keyword OR across the company relation.
-- These indexes do not guarantee that the planner will use them.
COMMIT;
