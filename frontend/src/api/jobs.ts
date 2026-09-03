import { apiRequest } from '../lib/api';
import type { CompanyJob, CreateJobRequest, JobDetail, JobListItem, JobQuery, Paginated } from '../types/api';

export function listJobs(query: JobQuery): Promise<Paginated<JobListItem>> {
  return apiRequest<Paginated<JobListItem>>('/jobs', { query: { ...query } });
}

export function getJob(id: string): Promise<JobDetail> {
  return apiRequest<JobDetail>(`/jobs/${id}`);
}

export function createJob(dto: CreateJobRequest): Promise<CompanyJob> {
  return apiRequest<CompanyJob>('/jobs', { method: 'POST', body: dto });
}

export function listMyJobs(): Promise<CompanyJob[]> {
  return apiRequest<CompanyJob[]>('/companies/me/jobs');
}
