export interface ApiGatewayEvent {
  body?: string | null;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
};

export function jsonResponse(statusCode: number, body: Record<string, unknown>): ApiResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function parseJsonBody<T>(event: ApiGatewayEvent): T {
  if (!event.body) {
    throw new Error('Request body is missing');
  }
  return JSON.parse(event.body) as T;
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
