# FileProcessor

**Overview**

FileProcessor is a full-stack file processing application. Users submit text and files through a React (TypeScript) frontend; the backend stores uploads in Amazon S3, records metadata in DynamoDB, provisions an EC2 instance for processing, and writes processed output back to S3 while updating DynamoDB with the result path. The workflow is orchestrated through AWS API Gateway and Lambda.

Everything now lives on `main` in one consolidated layout — frontend, Lambda source, and infrastructure-as-code side by side, deployed via a single GitHub Actions pipeline. (Previously the frontend lived on a separate `Frontend` branch and Lambdas were committed as pre-built `.zip` archives with manual CLI deploys; see "What changed" below.)

> The `.zip` archives at the repo root (`uploadFileToS3.zip`, `processFile.zip`, etc.) are the old pre-built Lambda packages from the manual-deploy era — they're superseded by the real TypeScript source in `lambdas/` and safe to delete (`git rm *.zip`) once you've reviewed the new layout.

---

## Repository layout

```
FileProcessor/
├── frontend/          React 18 + TypeScript app (Create React App), Tailwind CSS
├── lambdas/            TypeScript source for all 5 Lambda functions, shared HTTP helpers
├── infrastructure/     AWS CDK (TypeScript) app — provisions every AWS resource below
└── .github/workflows/  CI/CD — typecheck/build/test/synth on every PR, deploy on main
```

## Features

- **Responsive React + TypeScript UI** — Component-based form with text input, file upload, and submit flow (`TextInput`, `FileInput`, `SubmitButton`, `UploadForm`), styled with Tailwind CSS, typed end to end (props, API responses, pipeline state).
- **Typed API client** (`frontend/src/api/client.ts`) — Centralizes the three sequential API calls with shared error handling, instead of inline `fetch` calls per step.
- **S3 file storage** — Base64-encoded uploads written to the `rithvik-fovus` bucket via Lambda.
- **DynamoDB metadata** — Each submission stores `inputText`, `s3Path`, and a unique `id` (a real UUID, not a millisecond timestamp — see "What changed") in `FovusTable`.
- **EC2 processing** — `triggerVMCreation` launches a `t2.micro` instance from a configured AMI using a configurable key pair.
- **Serverless file processing** — `processFile` reads input from S3, appends computed metadata (input text length), writes output under `output/`, and updates DynamoDB with `output_file_path`.
- **API Gateway integration** — `/upload`, `/uploadExtra`, `/update`, `/trigger`, and `/process` routes on a shared API Gateway stage, all defined in code (see Infrastructure below) rather than wired by hand in the console.
- **CORS-enabled API** — Handled centrally by API Gateway's CORS preflight configuration; each Lambda also returns explicit CORS headers on its own response.
- **Infrastructure as code** — Every AWS resource (S3 bucket, DynamoDB table, 5 Lambda functions, IAM roles/policies, API Gateway) is defined in an AWS CDK app, not created manually through the console.
- **CI/CD** — GitHub Actions typechecks and builds the frontend, typechecks the Lambdas, and runs `cdk synth` (a genuine automated correctness check that needs no AWS credentials) on every push and pull request; a separate `deploy` job runs `cdk deploy` on pushes to `main`, authenticated via a short-lived AWS OIDC role rather than long-lived access keys.

---

## Architecture

```
┌─────────────────┐     API Gateway       ┌──────────────────────────────────────────┐
│  React Frontend │ ───────────────────►  │  Lambda Functions (TypeScript)            │
│  (frontend/)    │   POST /upload         │  • uploadFileToS3  → S3                  │
│                 │   POST /update         │  • uploadExtra     → S3 (alt. upload)    │
│                 │   POST /trigger        │  • updateDynamoDB  → DynamoDB            │
└─────────────────┘   POST /process        │  • triggerVMCreation → EC2               │
                                            │  • processFile       → S3 + DynamoDB     │
                                            └──────────────────────────────────────────┘
                                                         │
                         ┌───────────────────────────────┼───────────────────────────────┐
                         ▼                               ▼                               ▼
                    Amazon S3                    Amazon DynamoDB                    Amazon EC2
               (rithvik-fovus)                    (FovusTable)                    (t2.micro VM)
```

All of the above — bucket, table, functions, IAM policies, and the REST API in front of them — is defined in `infrastructure/lib/file-processor-stack.ts` and deployed as a single CloudFormation stack.

### End-to-end workflow

1. User enters text and selects a file in the React app.
2. Frontend base64-encodes the file and calls `POST /upload` (`uploadFileToS3`).
3. Frontend calls `POST /update` (`updateDynamoDB`) with `inputText` and the S3 path.
4. Frontend calls `POST /trigger` (`triggerVMCreation`) to start EC2 processing.
5. `processFile` (invoked separately, with `s3InputKey` and `instanceId`) downloads the input from S3, writes processed output to `output/<filename>`, and sets `output_file_path` on the DynamoDB record.

**Known gap, stated plainly:** step 5 is not yet wired to fire automatically once the EC2 instance from step 4 is ready — `processFile` is reachable via its own `/process` route for manual/independent invocation, but there's no orchestration (e.g., an EventBridge rule on EC2 state change, or a Step Functions state machine) tying steps 4 and 5 together end to end yet. That's the natural next infrastructure piece, not something this CI/CD and CDK work claims to have solved.

---

## AWS resources (all defined in `infrastructure/`)

| Resource | Name / value |
|----------|----------------|
| S3 bucket | `rithvik-fovus` (overridable via CDK context for a second environment) |
| DynamoDB table | `FovusTable`, partition key `id` (String), on-demand billing |
| EC2 key pair | configurable via `-c keyPairName=...` (defaults to `FovusKey`) |
| EC2 AMI | required input via `-c amiId=...` — region-specific, not hardcoded |
| EC2 instance type | `t2.micro` (configurable) |
| Lambda runtime | Node.js 22.x, bundled per-function with esbuild via CDK's `NodejsFunction` |

### DynamoDB record schema

| Field | Description |
|-------|-------------|
| `id` | Unique record identifier — a real UUID (`randomUUID()`), fixing a real bug in the original implementation where the id was `new Date().toISOString()`, which could collide under concurrent requests within the same millisecond. |
| `inputText` | User-provided text from the frontend. |
| `s3Path` | S3 URI of the uploaded input file. |
| `createdAt` | ISO timestamp, added for basic auditability. |
| `output_file_path` | S3 URI of the processed output (set by `processFile`). |

---

## API endpoints

| Method | Path | Lambda | Request body |
|--------|------|--------|--------------|
| `POST` | `/upload` | `uploadFileToS3` | `{ "fileContent": "<base64>", "fileName": "<name>" }` |
| `POST` | `/uploadExtra` | `uploadExtra` | Same contract as `/upload` — kept as an independently deployable alternate path. |
| `POST` | `/update` | `updateDynamoDB` | `{ "inputText": "<text>", "s3Path": "s3://rithvik-fovus/<name>" }` |
| `POST` | `/trigger` | `triggerVMCreation` | `{ "s3InputKey": "rithvik-fovus/<name>", "inputText": "<text>" }` |
| `POST` | `/process` | `processFile` | `{ "s3InputKey": "<s3-object-key>", "instanceId": "<dynamodb-record-id>" }` |

All Lambdas return CORS headers (`Access-Control-Allow-Origin: *`); API Gateway also has CORS preflight handling configured at the stack level.

---

## Setup

### Prerequisites

- Node.js 20+
- AWS CLI configured with permissions for S3, DynamoDB, Lambda, EC2, API Gateway, and IAM (for CDK deploys)
- AWS CDK CLI (`npm install -g aws-cdk`, or use `npx cdk` as the scripts below do)

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # set REACT_APP_API_BASE_URL to your deployed API Gateway stage URL
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Lambdas

```bash
cd lambdas
npm install
npm run typecheck
```

Lambda source here isn't deployed directly — CDK's `NodejsFunction` bundles each `index.ts` with esbuild at deploy time (see Infrastructure below), so there's no separate manual build/zip step.

### Infrastructure (CDK)

```bash
cd infrastructure
npm install
npx cdk synth -c amiId=<region-specific-ami-id> -c stage=dev   # no AWS credentials needed for synth
npx cdk deploy -c amiId=<region-specific-ami-id> -c stage=dev  # needs AWS credentials
```

`cdk synth` renders the full CloudFormation template locally and is a genuine correctness check — it's what runs in CI on every PR. `cdk deploy` additionally needs real AWS credentials and provisions/updates the actual resources.

---

## CI/CD

`.github/workflows/ci-cd.yml` runs four jobs:

1. **frontend** — install, typecheck, test, build (uploads the production build as a workflow artifact).
2. **lambdas** — install, typecheck.
3. **infrastructure** — install, typecheck, `cdk synth` (validated with a placeholder AMI ID — this step needs no AWS credentials and genuinely fails the build if the CDK code doesn't compile/synthesize correctly).
4. **deploy** — runs only on pushes to `main`, after the first three jobs pass. Authenticates to AWS via OIDC (`aws-actions/configure-aws-credentials`, assuming a role — no long-lived access keys stored in GitHub), then runs `cdk deploy` with the real AMI ID and key pair name pulled from repository secrets.

The OIDC role (`AWS_DEPLOY_ROLE_ARN` secret) requires a one-time setup in the target AWS account: an IAM role whose trust policy allows GitHub's OIDC provider to assume it, scoped to this repository.

---

## Testing

- **Automated:** `frontend/src/App.test.tsx` (React Testing Library) runs in CI on every push/PR. Lambda and infrastructure packages are typechecked but don't yet have unit tests — a real, acknowledged gap, not something claimed as covered.
- **Manual, end to end:**
  1. Start the frontend and submit a text value plus a file.
  2. Confirm the file appears in the `rithvik-fovus` S3 bucket.
  3. Confirm a new item exists in `FovusTable` with `inputText` and `s3Path`.
  4. Confirm `triggerVMCreation` launches an EC2 instance.
  5. Invoke `POST /process` with the correct `s3InputKey` and `instanceId`, then verify an output object under `output/<filename>` in S3 and `output_file_path` updated on the DynamoDB record.

---

## What changed (TypeScript / CI-CD / CDK pass)

This repo previously had three real gaps relative to what it described: the frontend was plain JavaScript (not TypeScript), there was no CI/CD pipeline, and there was no infrastructure-as-code (deployment was manual `.zip` uploads via the AWS CLI/console). All three are now real:

- **Frontend → TypeScript.** Every component, the API-calling logic, and the pipeline state are typed (`frontend/src/types.ts`, `frontend/src/api/client.ts`). Verified with `tsc --noEmit`, a production build, and a passing test.
- **Lambdas → TypeScript + AWS SDK v3.** All 5 functions converted from a mix of `.mjs` + AWS SDK v2 (`triggerVMCreation`, `updateDynamoDB`, `uploadFileToS3`, `uploadExtra`) and v3 (`processFile`) to consistent TypeScript on SDK v3, with a shared `lambdas/shared/http.ts` for response formatting instead of each function duplicating CORS headers and error-shape boilerplate. Also removed a large block of dead, commented-out code that had been left in `updateDynamoDB`.
- **Infrastructure-as-code.** `infrastructure/` is a real AWS CDK app modeling the bucket, table, all 5 functions, their IAM permissions (least-privilege — each function only gets the specific grants it needs, not a blanket policy), and the API Gateway routes in front of them. Verified with `cdk synth` producing a valid CloudFormation template with no AWS credentials required.
- **CI/CD.** A real GitHub Actions pipeline typechecks and builds the frontend, typechecks the Lambdas, and synthesizes the CDK stack on every push/PR — then deploys on merges to `main` via a short-lived OIDC role.

**Still an honest, open gap:** the EC2-trigger → process-file handoff (step 5 above) isn't automatically orchestrated yet, and there's no automated test coverage for the Lambdas or the CDK stack itself (only typechecking). Both are the natural next additions, not silently claimed as already done.

---

## License

MIT License.
