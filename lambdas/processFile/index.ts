import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import type { Readable } from 'node:stream';
import { jsonResponse, requiredEnv } from '../shared/http';

const s3 = new S3Client({});
const dynamoDb = new DynamoDBClient({});

interface ProcessFileEvent {
  s3InputKey?: string;
  instanceId?: string;
}

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

export const handler = async (event: ProcessFileEvent) => {
  console.log('Received event:', JSON.stringify(event));

  const bucket = requiredEnv('BUCKET_NAME');
  const tableName = requiredEnv('TABLE_NAME');
  const { s3InputKey, instanceId } = event;

  if (!s3InputKey) {
    console.error('Error: s3InputKey is undefined');
    return jsonResponse(400, { message: 'Error: s3InputKey is undefined' });
  }

  const s3OutputKey = `output/${s3InputKey.split('/').pop()}`;

  try {
    const inputFile = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3InputKey }));
    const inputText = await streamToString(inputFile.Body as Readable);
    const inputTextLength = inputText.length;

    const outputText = `${inputText}\nInput Text Length: ${inputTextLength}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3OutputKey,
        Body: outputText,
      }),
    );

    if (instanceId) {
      await dynamoDb.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: { id: { S: instanceId } },
          UpdateExpression: 'SET output_file_path = :path',
          ExpressionAttributeValues: {
            ':path': { S: `s3://${bucket}/${s3OutputKey}` },
          },
        }),
      );
    } else {
      console.warn('No instanceId provided — skipping DynamoDB record update.');
    }

    return jsonResponse(200, { message: 'File processed and DynamoDB updated successfully' });
  } catch (error) {
    console.error('Error processing file:', error);
    return jsonResponse(500, { message: 'File processing failed', error: (error as Error).message });
  }
};
