import { apiRequest } from '../lib/api';
import type { CvDownloadUrlResponse, CvFinalizeResponse, CvResponse, CvUploadUrlResponse } from '../types/api';

export function issueCvUploadUrl(dto: { fileName: string; sizeBytes: number; mimeType: 'application/pdf' }): Promise<CvUploadUrlResponse> {
  return apiRequest<CvUploadUrlResponse>('/me/cv/upload-url', { method: 'POST', body: dto });
}

export function finalizeCvUpload(attemptId: string): Promise<CvFinalizeResponse> {
  return apiRequest<CvFinalizeResponse>('/me/cv/finalize', { method: 'POST', body: { attemptId } });
}

export function getMyCv(): Promise<CvResponse> {
  return apiRequest<CvResponse>('/me/cv');
}

export function getMyCvDownloadUrl(): Promise<CvDownloadUrlResponse> {
  return apiRequest<CvDownloadUrlResponse>('/me/cv/download-url');
}

export function getApplicantCvUrl(applicationId: string): Promise<CvDownloadUrlResponse> {
  return apiRequest<CvDownloadUrlResponse>(`/applications/${applicationId}/cv-url`);
}
