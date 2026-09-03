/**
 * Demo data. Idempotent: users are upserted, jobs and applications are only
 * created when absent.
 *
 * Accounts (password for all: password123)
 *   company@indokerja.id   COMPANY     PT Nusantara Teknologi
 *   company2@indokerja.id  COMPANY     Bumi Digital Studio
 *   seeker@indokerja.id    JOB_SEEKER  Andi Pratama
 *   seeker2@indokerja.id   JOB_SEEKER  Sari Lestari
 */
import { ApplicationStatus, JobType, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password123';

interface CompanySeed {
  email: string;
  name: string;
  companyName: string;
  location: string;
  description: string;
}

interface JobSeed {
  title: string;
  description: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  jobType: JobType;
}

async function upsertCompanyUser(seed: CompanySeed, passwordHash: string) {
  return prisma.user.upsert({
    where: { email: seed.email },
    update: {},
    create: {
      email: seed.email,
      passwordHash,
      name: seed.name,
      role: Role.COMPANY,
      company: {
        create: { name: seed.companyName, location: seed.location, description: seed.description },
      },
    },
    include: { company: true },
  });
}

async function upsertSeeker(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name, role: Role.JOB_SEEKER },
  });
}

async function ensureJobs(companyId: string, jobs: JobSeed[]) {
  const existing = await prisma.job.count({ where: { companyId } });
  if (existing > 0) {
    return prisma.job.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
  }
  await prisma.job.createMany({ data: jobs.map((job) => ({ ...job, companyId })) });
  return prisma.job.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
}

interface ApplicationSeed {
  jobId: string;
  applicantId: string;
  coverLetter: string;
  /** Ordered status path; the first entry is always APPLIED. */
  path: { status: ApplicationStatus; changedById: string; note?: string }[];
}

async function ensureApplication(seed: ApplicationSeed) {
  const existing = await prisma.application.findUnique({
    where: { jobId_applicantId: { jobId: seed.jobId, applicantId: seed.applicantId } },
  });
  if (existing) {
    return existing;
  }

  const finalStatus = seed.path[seed.path.length - 1].status;
  return prisma.application.create({
    data: {
      jobId: seed.jobId,
      applicantId: seed.applicantId,
      coverLetter: seed.coverLetter,
      status: finalStatus,
      history: {
        create: seed.path.map((step, index) => ({
          fromStatus: index === 0 ? null : seed.path[index - 1].status,
          toStatus: step.status,
          changedById: step.changedById,
          note: step.note,
          // Spread history entries a few minutes apart so the timeline reads naturally.
          createdAt: new Date(Date.now() - (seed.path.length - index) * 15 * 60 * 1000),
        })),
      },
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const nusantara = await upsertCompanyUser(
    {
      email: 'company@indokerja.id',
      name: 'Rina Wijaya',
      companyName: 'PT Nusantara Teknologi',
      location: 'Jakarta',
      description:
        'Software house focused on fintech and insurance products for the Indonesian market.',
    },
    passwordHash,
  );
  const bumi = await upsertCompanyUser(
    {
      email: 'company2@indokerja.id',
      name: 'Budi Santoso',
      companyName: 'Bumi Digital Studio',
      location: 'Bandung',
      description: 'Creative digital agency building mobile apps and marketing sites.',
    },
    passwordHash,
  );
  const andi = await upsertSeeker('seeker@indokerja.id', 'Andi Pratama', passwordHash);
  const sari = await upsertSeeker('seeker2@indokerja.id', 'Sari Lestari', passwordHash);

  if (!nusantara.company || !bumi.company) {
    throw new Error('Company profiles were not created');
  }

  const nusantaraJobs = await ensureJobs(nusantara.company.id, [
    {
      title: 'Frontend Developer (React)',
      description:
        'Build and maintain customer-facing web apps with React and TypeScript. You will work closely with designers and backend engineers, own component quality, and help us improve performance and accessibility.',
      location: 'Jakarta',
      salaryMin: 8_000_000,
      salaryMax: 12_000_000,
      jobType: JobType.FULL_TIME,
    },
    {
      title: 'Backend Engineer (Node.js)',
      description:
        'Design REST APIs with NestJS and PostgreSQL for our insurance platform. Experience with Prisma, authentication, and writing maintainable, well-tested services is a big plus.',
      location: 'Jakarta (Hybrid)',
      salaryMin: 10_000_000,
      salaryMax: 15_000_000,
      jobType: JobType.FULL_TIME,
    },
    {
      title: 'QA Engineer Intern',
      description:
        'Help the team test new releases, write test cases, and automate regression checks. Great for final-year students who want hands-on experience in a product team.',
      location: 'Jakarta',
      salaryMin: 3_000_000,
      salaryMax: 4_000_000,
      jobType: JobType.INTERNSHIP,
    },
    {
      title: 'UI/UX Designer',
      description:
        'Own the end-to-end design of new features: research, wireframes, prototypes, and a consistent design system in Figma. Six-month contract with possible extension.',
      location: 'Remote',
      salaryMin: 7_000_000,
      salaryMax: 10_000_000,
      jobType: JobType.CONTRACT,
    },
  ]);

  const bumiJobs = await ensureJobs(bumi.company.id, [
    {
      title: 'Mobile Developer (Flutter)',
      description:
        'Ship cross-platform apps for our clients using Flutter. You should be comfortable with state management, REST integration, and publishing to both app stores.',
      location: 'Bandung',
      salaryMin: 7_000_000,
      salaryMax: 11_000_000,
      jobType: JobType.FULL_TIME,
    },
    {
      title: 'Data Analyst (Part-time)',
      description:
        'Turn campaign data into clear dashboards and weekly insights for our clients. SQL and spreadsheet skills required; Looker Studio experience is a plus.',
      location: 'Bandung',
      salaryMin: 4_000_000,
      salaryMax: 6_000_000,
      jobType: JobType.PART_TIME,
    },
    {
      title: 'DevOps Engineer',
      description:
        'Maintain our CI/CD pipelines and cloud infrastructure (Docker, GitHub Actions, and managed Postgres). Remote-first role with occasional visits to the Bandung office.',
      location: 'Remote',
      salaryMin: 12_000_000,
      salaryMax: 18_000_000,
      jobType: JobType.FULL_TIME,
    },
  ]);

  const [frontendJob, backendJob] = nusantaraJobs;
  const [flutterJob] = bumiJobs;

  await ensureApplication({
    jobId: frontendJob.id,
    applicantId: andi.id,
    coverLetter:
      'I have two years of experience building React dashboards and would love to contribute to your fintech products.',
    path: [
      { status: ApplicationStatus.APPLIED, changedById: andi.id, note: 'Application submitted' },
      {
        status: ApplicationStatus.REVIEWING,
        changedById: nusantara.id,
        note: 'CV looks promising, scheduling a call',
      },
    ],
  });

  await ensureApplication({
    jobId: flutterJob.id,
    applicantId: andi.id,
    coverLetter:
      'Currently building a Flutter app during my internship and looking for a full-time role.',
    path: [
      { status: ApplicationStatus.APPLIED, changedById: andi.id, note: 'Application submitted' },
    ],
  });

  await ensureApplication({
    jobId: frontendJob.id,
    applicantId: sari.id,
    coverLetter: 'Frontend developer with a strong eye for accessible, responsive interfaces.',
    path: [
      { status: ApplicationStatus.APPLIED, changedById: sari.id, note: 'Application submitted' },
      { status: ApplicationStatus.REVIEWING, changedById: nusantara.id },
      {
        status: ApplicationStatus.SHORTLISTED,
        changedById: nusantara.id,
        note: 'Technical interview on Friday',
      },
    ],
  });

  await ensureApplication({
    jobId: backendJob.id,
    applicantId: sari.id,
    coverLetter: 'I enjoy designing clean APIs and have shipped several NestJS services.',
    path: [
      { status: ApplicationStatus.APPLIED, changedById: sari.id, note: 'Application submitted' },
    ],
  });

  console.log('Seed complete. Demo password for all accounts: password123');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
