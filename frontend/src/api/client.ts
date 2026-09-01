import type { ApiErrorBody, TriggerVmResponse, UpdateDynamoDbResponse, UploadResponse } from '../types';

// Set via REACT_APP_API_BASE_URL at build time (see .env.example). CI/CD injects the real
// deployed API Gateway stage URL; falling back to empty string keeps local dev from crashing
// before a .env.local is created.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? '';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      detail = errorBody.error ?? errorBody.message ?? detail;
    } catch {
      // response body wasn't JSON — fall back to statusText
    }
    throw new Error(`${path} failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

export function uploadFile(fileName: string, base64Content: string): Promise<UploadResponse> {
  return postJson<UploadResponse>('/upload', { fileName, fileContent: base64Content });
}

export function recordUpload(inputText: string, s3Path: string): Promise<UpdateDynamoDbResponse> {
  return postJson<UpdateDynamoDbResponse>('/update', { inputText, s3Path });
}

export function triggerProcessing(s3InputKey: string, inputText: string): Promise<TriggerVmResponse> {
  return postJson<TriggerVmResponse>('/trigger', { s3InputKey, inputText });
}
