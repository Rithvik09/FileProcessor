# FileProcessor

**Overview**

FileProcessor is a full-stack file processing application. Users submit text and files through a React frontend; the backend stores uploads in Amazon S3, records metadata in DynamoDB, provisions an EC2 instance for processing, and writes processed output back to S3 while updating DynamoDB with the result path. The workflow is orchestrated through AWS API Gateway and Lambda.

The React frontend source lives on the [`Frontend`](https://github.com/Rithvik09/FileProcessor/tree/Frontend) branch. Lambda function source code is packaged in this repository as deployable `.zip` archives.

---

## Features

- **Responsive React UI** — Component-based form with text input, file upload, and submit flow (`TextInput`, `FileInput`, `SubmitButton`, `UploadForm`), styled with Tailwind CSS.
- **S3 file storage** — Base64-encoded uploads written to the `rithvik-fovus` bucket via Lambda.
- **DynamoDB metadata** — Each submission stores `inputText`, `s3Path`, and a unique `id` in `FovusTable`.
- **EC2 processing** — `triggerVMCreation` launches a `t2.micro` instance from a configured AMI using the `FovusKey` key pair.
- **Serverless file processing** — `processFile` reads input from S3, appends computed metadata (input text length), writes output under `output/`, and updates DynamoDB with `output_file_path`.
- **API Gateway integration** — Frontend calls `/upload`, `/update`, and `/trigger` endpoints on a shared API Gateway stage.
- **CORS-enabled Lambdas** — Upload, update, and trigger functions return permissive CORS headers for browser access.
- **Lambda layer support** — `nodejs.zip` provides shared Node.js dependencies (including `aws-sdk`) for Lambda deployment.

---

## Architecture

```
┌─────────────────┐     API Gateway      ┌──────────────────────────────────────────┐
│  React Frontend │ ───────────────────► │  Lambda Functions                        │
│  (Frontend br.) │   POST /upload         │  • uploadFileToS3  → S3                  │
│                 │   POST /update         │  • uploadExtra     → S3 (alt. upload)    │
│                 │   POST /trigger        │  • updateDynamoDB  → DynamoDB            │
└─────────────────┘                        │  • triggerVMCreation → EC2               │
                                           │  • processFile       → S3 + DynamoDB     │
                                           └──────────────────────────────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        ▼                               ▼                               ▼
                   Amazon S3                    Amazon DynamoDB                    Amazon EC2
              (rithvik-fovus)                    (FovusTable)                    (t2.micro VM)
```

### End-to-end workflow

1. User enters text and selects a file in the React app.
2. Frontend base64-encodes the file and calls `POST /upload` (`uploadFileToS3`).
3. Frontend calls `POST /update` (`updateDynamoDB`) with `inputText` and the S3 path.
4. Frontend calls `POST /trigger` (`triggerVMCreation`) to start EC2 processing.
5. `processFile` (invoked with `s3InputKey` and `instanceId`) downloads the input from S3, writes processed output to `output/<filename>`, and sets `output_file_path` on the DynamoDB record.

---

## Repository contents (source archives)

| Archive | Description |
|---------|-------------|
| `uploadFileToS3.zip` | Primary upload Lambda — accepts `fileContent` (base64) and `fileName`, stores PDF in S3. |
| `uploadExtra.zip` | Alternate upload Lambda with the same S3 upload contract as `uploadFileToS3`. |
| `updateDynamoDB.zip` | Metadata Lambda — accepts `inputText` and `s3Path`, writes a record to `FovusTable`. |
| `triggerVMCreation.zip` | EC2 Lambda — launches a `t2.micro` instance (`ami-0296a329aeec73707`, key `FovusKey`). |
| `processFile.zip` | Processing Lambda — reads from S3, writes output, updates DynamoDB `output_file_path`. Uses AWS SDK v3. |
| `nodejs.zip` | Lambda layer — shared Node.js runtime dependencies (`aws-sdk`, etc.). |

### Frontend source (`Frontend` branch)

| File | Purpose |
|------|---------|
| `App.js` | Root component rendering `UploadForm`. |
| `UploadForm.js` | Orchestrates upload → DynamoDB update → VM trigger API calls. |
| `TextInput.js` | Text field for user input. |
| `FileInput.js` | File picker for document upload. |
| `SubmitButton.js` | Form submit control. |
| `tailwind.config.js` | Tailwind CSS configuration. |
| `package.json` | React 18 app with AWS SDK v3 client packages. |

---

## AWS resources

| Resource | Name / value |
|----------|----------------|
| S3 bucket | `rithvik-fovus` |
| DynamoDB table | `FovusTable` |
| EC2 key pair | `FovusKey` |
| EC2 AMI | `ami-0296a329aeec73707` |
| EC2 instance type | `t2.micro` |
| API Gateway base URL | `https://dbphncz8o2.execute-api.us-east-2.amazonaws.com/dev` |

### DynamoDB record schema

| Field | Description |
|-------|-------------|
| `id` | Unique record identifier (ISO timestamp on create). |
| `inputText` | User-provided text from the frontend. |
| `s3Path` | S3 URI of the uploaded input file. |
| `output_file_path` | S3 URI of the processed output (set by `processFile`). |

---

## API endpoints

| Method | Path | Lambda | Request body |
|--------|------|--------|--------------|
| `POST` | `/upload` | `uploadFileToS3` | `{ "fileContent": "<base64>", "fileName": "<name>" }` |
| `POST` | `/update` | `updateDynamoDB` | `{ "inputText": "<text>", "s3Path": "s3://rithvik-fovus/<name>" }` |
| `POST` | `/trigger` | `triggerVMCreation` | `{ "s3InputKey": "rithvik-fovus/<name>", "inputText": "<text>" }` |

`processFile` is invoked directly (not via the frontend API flow above) with:

```json
{
  "s3InputKey": "<s3-object-key>",
  "instanceId": "<dynamodb-record-id>"
}
```

All browser-facing Lambdas return CORS headers (`Access-Control-Allow-Origin: *`).

---

## Setup

### Prerequisites

- Node.js and npm
- AWS CLI configured with permissions for S3, DynamoDB, Lambda, EC2, and API Gateway
- An S3 bucket (`rithvik-fovus`), DynamoDB table (`FovusTable`), and EC2 key pair (`FovusKey`) provisioned in your account

### Frontend

```bash
git clone https://github.com/Rithvik09/FileProcessor.git
cd FileProcessor
git checkout Frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Update the API Gateway URLs in `UploadForm.js` if deploying to a different stage or region.

### Backend (Lambda deployment)

Upload each `.zip` archive to its corresponding Lambda function via the AWS Console or CLI:

```bash
aws lambda update-function-code \
  --function-name uploadFileToS3 \
  --zip-file fileb://uploadFileToS3.zip

aws lambda update-function-code \
  --function-name updateDynamoDB \
  --zip-file fileb://updateDynamoDB.zip

aws lambda update-function-code \
  --function-name triggerVMCreation \
  --zip-file fileb://triggerVMCreation.zip

aws lambda update-function-code \
  --function-name processFile \
  --zip-file fileb://processFile.zip

aws lambda update-function-code \
  --function-name uploadExtra \
  --zip-file fileb://uploadExtra.zip
```

Attach `nodejs.zip` as a Lambda layer where functions depend on the bundled `aws-sdk` runtime.

Wire each function to API Gateway routes (`/upload`, `/update`, `/trigger`) and ensure IAM roles grant access to the S3 bucket, DynamoDB table, and EC2 `RunInstances` permission.

---

## Testing

1. Start the frontend and submit a text value plus a file.
2. Confirm the file appears in the `rithvik-fovus` S3 bucket.
3. Confirm a new item exists in `FovusTable` with `inputText` and `s3Path`.
4. Confirm `triggerVMCreation` launches an EC2 instance.
5. Invoke `processFile` with the correct `s3InputKey` and `instanceId`, then verify:
   - Output object under `output/<filename>` in S3
   - `output_file_path` updated on the DynamoDB record

---

## Branches

| Branch | Contents |
|--------|----------|
| `main` | README and deployable Lambda `.zip` archives |
| `Frontend` | React application source, Tailwind config, and all `.zip` archives |

---

## License

MIT License.
