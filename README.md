# FileProcessor

Overview
FileProcessor is a web application that allows users to upload files and input text through a responsive frontend built with ReactJS. The uploaded files and text inputs are processed through various AWS services, including S3, DynamoDB, Lambda, and EC2, to perform automated tasks such as metadata storage, VM-based processing, and final output management. The entire workflow is automated, ensuring seamless integration between the frontend and backend components.

Features
Responsive Web UI: A user-friendly interface for text and file input.
AWS S3 Integration: Secure file storage in AWS S3 buckets.
DynamoDB Metadata Storage: Automatic metadata storage for files and inputs in DynamoDB.
Automated VM Processing: Trigger EC2 instances to process files with custom scripts.
Infrastructure as Code: Deploy and manage AWS resources using AWS CDK.
Architecture
Frontend (ReactJS):

Users upload files and input text through a web interface.
The application sends this data to the backend via AWS API Gateway.
Backend (AWS Lambda & API Gateway):

Lambda Functions:
uploadFileToS3: Handles file uploads to S3.
updateDynamoDB: Stores metadata in DynamoDB.
triggerVMCreation: Initiates a VM in EC2 to process the file and text input.
API Gateway:
Manages API endpoints that connect the frontend to the backend services.
AWS Services:

S3: Stores the uploaded files.
DynamoDB: Stores metadata related to the files and inputs.
EC2: Runs a VM to process the uploaded files and generates output.
Automation:

The process is triggered by DynamoDB events and handled by Lambda functions, ensuring end-to-end automation.
Setup Instructions
Prerequisites
Node.js and npm/yarn
AWS CLI configured with the necessary permissions.
AWS CDK installed globally.
Frontend Setup
Clone the repository:

bash
Copy code
git clone https://github.com/yourusername/fileprocessor.git
cd fileprocessor/frontend
Install dependencies:

bash
Copy code
npm install
Run the application locally:

bash
Copy code
npm start
Open your browser and navigate to http://localhost:3000 to see the frontend in action.

Backend Setup
Navigate to the backend directory:

bash
Copy code
cd ../backend
Deploy the Lambda functions using the AWS CLI or AWS Management Console:

Option 1: Deploy manually by uploading the Lambda function code via the AWS Console.
Option 2: Use aws lambda update-function-code to upload the code from your local environment.
Ensure that your AWS resources (S3, DynamoDB, EC2) are correctly set up and that the necessary IAM roles are assigned.

Infrastructure Deployment (AWS CDK)
Navigate to the infrastructure directory:

bash
Copy code
cd ../infrastructure/cdk
Install CDK dependencies:

bash
Copy code
npm install
Deploy the infrastructure:

bash
Copy code
cdk deploy
Environment Variables
Ensure the following environment variables are configured in your Lambda functions:

TABLE_NAME: The name of the DynamoDB table.
BUCKET_NAME: The name of the S3 bucket.
Other variables specific to your AWS environment.
API Endpoints
POST /upload: Uploads a file to S3 and stores metadata in DynamoDB.
POST /process: Triggers the VM creation and processes the uploaded file.
Testing and Verification
Upload a File:

Test the file upload feature via the frontend.
Verify that the file is stored in S3 and that the corresponding metadata is in DynamoDB.
Trigger VM Processing:

Ensure the Lambda function triggers EC2 instance creation and processes the file.
Check Outputs:

Verify that the output is uploaded back to S3 and that DynamoDB is updated accordingly.
Contributing
Feel free to fork this repository and submit pull requests. All contributions are welcome!

License
This project is licensed under the MIT License.

Contact
For any inquiries or issues, please contact your.email@example.com.
