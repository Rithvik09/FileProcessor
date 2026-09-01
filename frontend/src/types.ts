export interface UploadResponse {
  message: string;
}

export interface UpdateDynamoDbResponse {
  message: string;
}

export interface TriggerVmResponse {
  message: string;
  data?: {
    Instances?: Array<{ InstanceId?: string }>;
  };
}

export interface ApiErrorBody {
  message: string;
  error?: string;
}

export type PipelineStage = 'idle' | 'uploading' | 'recording' | 'triggering' | 'done' | 'error';
