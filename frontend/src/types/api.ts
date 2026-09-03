/** Types mirroring the backend REST responses. Keep in sync with docs/API.md. */

export type Role = 'JOB_SEEKER' | 'COMPANY';

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';

export type ApplicationStatus = 'APPLIED' | 'REVIEWING' | 'SHORTLISTED' | 'REJECTED' | 'ACCEPTED';

export interface CompanySummary {
  id: string;
  name: string;
  location: string | null;
  description?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  company: CompanySummary | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
  companyName?: string;
  companyLocation?: string;
  companyDescription?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface JobListItem {
  id: string;
  title: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  jobType: JobType;
  isActive: boolean;
  createdAt: string;
  company: CompanySummary;
}

export interface JobDetail extends JobListItem {
  companyId: string;
  description: string;
  updatedAt: string;
  applicationsCount: number;
  myApplication: { id: string; status: ApplicationStatus; createdAt: string } | null;
}

export interface CompanyJob {
  id: string;
  companyId: string;
  title: string;
  description: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  jobType: JobType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  applicationsCount: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  jobType: JobType;
}

export interface JobQuery {
  page?: number;
  limit?: number;
  search?: string;
  jobType?: JobType;
}

export interface JobSummary {
  id: string;
  title: string;
  location: string;
  jobType: JobType;
  salaryMin: number;
  salaryMax: number;
  companyId: string;
  company: { id: string; name: string };
}

export interface Applicant {
  id: string;
  name: string;
  email: string;
}

export interface ApplicationBase {
  id: string;
  jobId: string;
  applicantId: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyApplication extends ApplicationBase {
  job: JobSummary;
}

export interface JobApplicant extends ApplicationBase {
  applicant: Applicant;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
  changedBy: { id: string; name: string; role: Role };
}

export interface ApplicationDetail extends ApplicationBase {
  job: JobSummary;
  applicant: Applicant;
  history: StatusHistoryEntry[];
}

export interface JobApplicantsResponse {
  job: { id: string; title: string };
  data: JobApplicant[];
}

export interface UpdateStatusRequest {
  status: ApplicationStatus;
  note?: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
