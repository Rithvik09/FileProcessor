import { _InstanceType, EC2Client, RunInstancesCommand } from '@aws-sdk/client-ec2';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonResponse, requiredEnv } from '../shared/http';

const ec2 = new EC2Client({});

function resolveInstanceType(value: string): _InstanceType {
  if (!(Object.values(_InstanceType) as string[]).includes(value)) {
    throw new Error(`Unsupported EC2 instance type: ${value}`);
  }
  return value as _InstanceType;
}

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const imageId = requiredEnv('AMI_ID');
  const instanceType = resolveInstanceType(process.env.INSTANCE_TYPE ?? _InstanceType.t2_micro);
  const keyName = requiredEnv('KEY_PAIR_NAME');

  try {
    const result = await ec2.send(
      new RunInstancesCommand({
        ImageId: imageId,
        InstanceType: instanceType,
        MinCount: 1,
        MaxCount: 1,
        KeyName: keyName,
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [{ Key: 'Purpose', Value: 'file-processor-processing' }],
          },
        ],
      }),
    );
    return jsonResponse(200, { message: 'EC2 instance creation successful', data: result });
  } catch (error) {
    console.error('EC2 instance creation error:', error);
    return jsonResponse(500, { message: 'EC2 instance creation failed', error: (error as Error).message });
  }
};
