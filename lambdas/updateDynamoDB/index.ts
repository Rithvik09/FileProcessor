import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonResponse, parseJsonBody, requiredEnv } from '../shared/http';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface UpdateRequestBody {
  inputText: string;
  s3Path: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let body: UpdateRequestBody;
  try {
    body = parseJsonBody<UpdateRequestBody>(event);
  } catch (error) {
    return jsonResponse(400, { message: 'Invalid JSON input', error: (error as Error).message });
  }

  const tableName = requiredEnv('TABLE_NAME');

  try {
    const id = randomUUID();
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id,
          inputText: body.inputText,
          s3Path: body.s3Path,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    return jsonResponse(200, { message: 'DynamoDB update successful', id });
  } catch (error) {
    console.error('DynamoDB update error:', error);
    return jsonResponse(500, { message: 'DynamoDB update failed', error: (error as Error).message });
  }
};
