#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FileProcessorStack } from '../lib/file-processor-stack';

const app = new cdk.App();

// AMI IDs are region-specific and the EC2 key pair must already exist in the target
// account/region — both stay required inputs (context or env var) rather than baked-in
// defaults, since a stale hardcoded AMI ID silently breaks `triggerVMCreation` in a way
// that's easy to miss until the pipeline actually runs an EC2 launch.
const stage = (app.node.tryGetContext('stage') as string) ?? process.env.STAGE ?? 'dev';
const amiId = (app.node.tryGetContext('amiId') as string) ?? process.env.AMI_ID;
const keyPairName = (app.node.tryGetContext('keyPairName') as string) ?? process.env.KEY_PAIR_NAME ?? 'FovusKey';

if (!amiId) {
  throw new Error(
    'Missing amiId. Pass it via `cdk deploy -c amiId=ami-xxxxxxxx` or set the AMI_ID environment variable — ' +
      'see README for the region-specific AMI this project was originally deployed against.',
  );
}

new FileProcessorStack(app, `FileProcessorStack-${stage}`, {
  stage,
  amiId,
  keyPairName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-2',
  },
  tags: {
    project: 'file-processor',
    stage,
  },
});
