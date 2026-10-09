import { apiRequest } from '../lib/api';
import type { Paginated, SavedJob, SavedJobLookup, SaveJobResponse } from '../types/api';

export function saveJob(id: string): Promise<SaveJobResponse> {
  return apiRequest<SaveJobResponse>(`/jobs/${id}/save`, { method: 'POST' });
}

export function unsaveJob(id: string): Promise<void> {
  return apiRequest<void>(`/jobs/${id}/save`, { method: 'DELETE' });
}

export function listSavedJobs(page = 1, limit = 20): Promise<Paginated<SavedJob>> {
  return apiRequest<Paginated<SavedJob>>('/me/saved-jobs', { query: { page, limit } });
}

export function lookupSavedJobs(jobIds: string[]): Promise<{ data: SavedJobLookup[] }> {
  if (jobIds.length > 50) throw new Error('Lookup maksimal 50 lowongan.');
  return apiRequest<{ data: SavedJobLookup[] }>('/me/saved-jobs', { query: { jobIds: [...new Set(jobIds)].join(',') } });
}
