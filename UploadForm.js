import React, { useState } from 'react';
import TextInput from './TextInput';
import FileInput from './FileInput';
import SubmitButton from './SubmitButton';

function UploadForm() {
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');

    const handleTextChange = (e) => {
        setText(e.target.value);
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64FileContent = reader.result.split(",")[1];

            try {
                // Upload file to S3
                const uploadResponse = await fetch('https://dbphncz8o2.execute-api.us-east-2.amazonaws.com/dev/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fileContent: base64FileContent,
                        fileName: file.name,
                    }),
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Upload error: ${uploadResponse.statusText}`);
                }

                const uploadData = await uploadResponse.json();
                console.log(uploadData);

                // Update DynamoDB
                const updateResponse = await fetch('https://dbphncz8o2.execute-api.us-east-2.amazonaws.com/dev/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputText: text,
                        s3Path: `s3://rithvik-fovus/${file.name}`,
                    }),
                });

                if (!updateResponse.ok) {
                    throw new Error(`Update error: ${updateResponse.statusText}`);
                }

                const updateData = await updateResponse.json();
                console.log(updateData);

                // Trigger VM creation
                const triggerResponse = await fetch('https://dbphncz8o2.execute-api.us-east-2.amazonaws.com/dev/trigger', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        s3InputKey: `rithvik-fovus/${file.name}`,
                        inputText: text
                    }),
                });

                if (!triggerResponse.ok) {
                    throw new Error(`Trigger error: ${triggerResponse.statusText}`);
                }

                const triggerData = await triggerResponse.json();
                console.log(triggerData);

                setMessage("All operations completed successfully!");
            } catch (error) {
                console.error('Error:', error);
                setMessage(`An error occurred: ${error.message}`);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-4">
            <form onSubmit={handleSubmit}>
                <TextInput value={text} onChange={handleTextChange} />
                <FileInput onChange={handleFileChange} />
                <SubmitButton onClick={handleSubmit} />
            </form>
            {message && <p>{message}</p>}
        </div>
    );
}

export default UploadForm;
