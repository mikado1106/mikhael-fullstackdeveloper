import { apiRequest } from '../lib/api';
import type {
  ApplicationDetail,
  JobApplicantsResponse,
  MyApplication,
  UpdateStatusRequest,
} from '../types/api';

export function applyToJob(jobId: string, coverLetter?: string): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/jobs/${jobId}/applications`, {
    method: 'POST',
    body: coverLetter ? { coverLetter } : {},
  });
}

export function listMyApplications(): Promise<MyApplication[]> {
  return apiRequest<MyApplication[]>('/applications/me');
}

export function getApplication(id: string): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/applications/${id}`);
}

export function listJobApplicants(jobId: string): Promise<JobApplicantsResponse> {
  return apiRequest<JobApplicantsResponse>(`/jobs/${jobId}/applications`);
}

export function updateApplicationStatus(id: string, dto: UpdateStatusRequest): Promise<ApplicationDetail> {
  return apiRequest<ApplicationDetail>(`/applications/${id}/status`, { method: 'PATCH', body: dto });
}
