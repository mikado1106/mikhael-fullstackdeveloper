import { apiRequest } from '../lib/api';
import type {
  ApplicationDetail,
  JobApplicantsResponse,
  MyApplication,
  Paginated,
  UpdateStatusRequest,
} from '../types/api';

export function applyToJob(jobId: string, coverLetter?: string): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/jobs/${jobId}/applications`, {
    method: 'POST',
    body: coverLetter ? { coverLetter } : {},
  });
}

export function listMyApplications(page = 1): Promise<Paginated<MyApplication>> {
  return apiRequest<Paginated<MyApplication>>('/applications/me', { query: { page } });
}

export function getApplication(id: string): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/applications/${id}`);
}

export function listJobApplicants(jobId: string, page = 1): Promise<JobApplicantsResponse> {
  return apiRequest<JobApplicantsResponse>(`/jobs/${jobId}/applications`, { query: { page } });
}

export function updateApplicationStatus(id: string, dto: UpdateStatusRequest): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/applications/${id}/status`, { method: 'PATCH', body: dto });
}
