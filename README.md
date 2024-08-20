# FileProcessor

**Overview:**
FileProcessor is an application that allows users to upload files and input text through a responsive frontend built with ReactJS. The uploaded files and text inputs are processed through various AWS services, including S3, DynamoDB, Lambda, and EC2, to perform automated tasks such as metadata storage, VM-based processing, and final output management. The entire workflow is automated, ensuring seamless integration between the frontend and backend components.



**Features:**

Responsive Web UI: A user-friendly interface for text and file input.

AWS S3 Integration: Secure file storage in AWS S3 buckets.

DynamoDB Metadata Storage: Automatic metadata storage for files and inputs in DynamoDB.

Automated VM Processing: Trigger EC2 instances to process files with custom scripts.

Infrastructure as Code: Deploy and manage AWS resources using AWS CDK.



**Architecture:**

Frontend (ReactJS):
Users upload files and input text through a web interface.
The application sends this data to the backend via AWS API Gateway.


Backend (AWS Lambda & API Gateway):
uploadFileToS3: Handles file uploads to S3.

updateDynamoDB: Stores metadata in DynamoDB.

triggerVMCreation: Initiates a VM in EC2 to process the file and text input.


TABLE_NAME: The name of the DynamoDB table.
BUCKET_NAME: The name of the S3 bucket.
Other variables specific to your AWS environment.
