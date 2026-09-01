import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonResponse, parseJsonBody, requiredEnv } from '../shared/http';

const s3 = new S3Client({});

interface UploadRequestBody {
  fileContent: string; // base64-encoded
  fileName: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let body: UploadRequestBody;
  try {
    body = parseJsonBody<UploadRequestBody>(event);
  } catch (error) {
    return jsonResponse(400, { message: 'Invalid JSON input', error: (error as Error).message });
  }

  const bucket = requiredEnv('BUCKET_NAME');

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: body.fileName,
        Body: Buffer.from(body.fileContent, 'base64'),
        ContentEncoding: 'base64',
        ContentType: 'application/pdf',
      }),
    );
    return jsonResponse(200, { message: 'File uploaded successfully' });
  } catch (error) {
    console.error('S3 upload error:', error);
    return jsonResponse(500, { message: 'File upload failed', error: (error as Error).message });
  }
};
