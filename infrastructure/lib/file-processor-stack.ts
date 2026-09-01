import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface FileProcessorStackProps extends cdk.StackProps {
  /** Deployment stage, e.g. "dev" or "prod" — becomes the API Gateway stage name. */
  stage: string;
  /**
   * Bucket/table names default to the project's original manually-created resources
   * (`rithvik-fovus` / `FovusTable`) so this stack models exactly what's already deployed.
   * Override these for a genuinely separate environment, since S3 bucket names must be
   * globally unique — you can't deploy a second stack with the same default name.
   */
  bucketName?: string;
  tableName?: string;
  amiId: string;
  keyPairName: string;
  instanceType?: string;
}

const LAMBDAS_DIR = path.join(__dirname, '..', '..', 'lambdas');

export class FileProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FileProcessorStackProps) {
    super(scope, id, props);

    const bucketName = props.bucketName ?? 'rithvik-fovus';
    const tableName = props.tableName ?? 'FovusTable';

    const bucket = new s3.Bucket(this, 'FileProcessorBucket', {
      bucketName,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    const table = new dynamodb.Table(this, 'FileProcessorTable', {
      tableName,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const commonProps: Partial<NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      bundling: { minify: true, sourceMap: true, target: 'node22' },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      // Lambda source lives in a sibling `lambdas/` package with its own lockfile, not
      // nested under this CDK app — point esbuild bundling at that package explicitly
      // rather than relying on NodejsFunction's default "nearest lockfile above the
      // entry file" auto-detection, which assumes a single monorepo-root lockfile.
      projectRoot: LAMBDAS_DIR,
      depsLockFilePath: path.join(LAMBDAS_DIR, 'package-lock.json'),
    };

    // --- upload / uploadExtra: write-only access to the bucket ---
    const uploadFn = new NodejsFunction(this, 'UploadFileToS3Fn', {
      ...commonProps,
      entry: path.join(LAMBDAS_DIR, 'uploadFileToS3', 'index.ts'),
      environment: { BUCKET_NAME: bucket.bucketName },
    });
    bucket.grantPut(uploadFn);

    const uploadExtraFn = new NodejsFunction(this, 'UploadExtraFn', {
      ...commonProps,
      entry: path.join(LAMBDAS_DIR, 'uploadExtra', 'index.ts'),
      environment: { BUCKET_NAME: bucket.bucketName },
    });
    bucket.grantPut(uploadExtraFn);

    // --- update: write-only access to the table ---
    const updateFn = new NodejsFunction(this, 'UpdateDynamoDbFn', {
      ...commonProps,
      entry: path.join(LAMBDAS_DIR, 'updateDynamoDB', 'index.ts'),
      environment: { TABLE_NAME: table.tableName },
    });
    table.grantWriteData(updateFn);

    // --- trigger: needs ec2:RunInstances, which is not table/bucket scoped ---
    const triggerFn = new NodejsFunction(this, 'TriggerVmCreationFn', {
      ...commonProps,
      entry: path.join(LAMBDAS_DIR, 'triggerVMCreation', 'index.ts'),
      environment: {
        AMI_ID: props.amiId,
        KEY_PAIR_NAME: props.keyPairName,
        INSTANCE_TYPE: props.instanceType ?? 't2.micro',
      },
    });
    triggerFn.addToRolePolicy(
      new iam.PolicyStatement({
        // RunInstances authorization spans several resource types (instance, image,
        // key-pair, subnet, security-group) simultaneously — scoping this to a single
        // resource ARN isn't possible without also pinning a specific VPC/subnet, which
        // this project doesn't otherwise constrain. Left as a named follow-up rather than
        // silently claiming tighter scoping than what's actually enforced.
        actions: ['ec2:RunInstances', 'ec2:CreateTags'],
        resources: ['*'],
      }),
    );

    // --- process: reads + writes the bucket, writes the table ---
    const processFn = new NodejsFunction(this, 'ProcessFileFn', {
      ...commonProps,
      entry: path.join(LAMBDAS_DIR, 'processFile', 'index.ts'),
      timeout: cdk.Duration.seconds(60),
      environment: { BUCKET_NAME: bucket.bucketName, TABLE_NAME: table.tableName },
    });
    bucket.grantReadWrite(processFn);
    table.grantWriteData(processFn);

    // --- API Gateway: one REST API fronting all five functions ---
    const api = new apigateway.RestApi(this, 'FileProcessorApi', {
      restApiName: `file-processor-${props.stage}`,
      deployOptions: { stageName: props.stage },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    api.root.addResource('upload').addMethod('POST', new apigateway.LambdaIntegration(uploadFn));
    api.root.addResource('uploadExtra').addMethod('POST', new apigateway.LambdaIntegration(uploadExtraFn));
    api.root.addResource('update').addMethod('POST', new apigateway.LambdaIntegration(updateFn));
    api.root.addResource('trigger').addMethod('POST', new apigateway.LambdaIntegration(triggerFn));
    // processFile isn't called by the current frontend (it's meant to run once the
    // triggered EC2 instance is ready) — exposed here so it's independently invocable
    // for testing/manual runs rather than only reachable via a future orchestration step.
    api.root.addResource('process').addMethod('POST', new apigateway.LambdaIntegration(processFn));

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'BucketNameOutput', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'TableNameOutput', { value: table.tableName });
  }
}
