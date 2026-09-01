import { useState } from 'react';
import TextInput from './TextInput';
import FileInput from './FileInput';
import SubmitButton from './SubmitButton';
import { recordUpload, triggerProcessing, uploadFile } from '../api/client';
import type { PipelineStage } from '../types';

const S3_BUCKET = 'rithvik-fovus';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result type'));
        return;
      }
      // result is a data URL ("data:<mime>;base64,<content>") — strip the prefix.
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function UploadForm() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [message, setMessage] = useState('');

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleSubmit = async (event: React.FormEvent | React.MouseEvent) => {
    event.preventDefault();
    if (!file) {
      setMessage('Choose a file first.');
      return;
    }

    try {
      const base64Content = await readFileAsBase64(file);
      const s3Path = `s3://${S3_BUCKET}/${file.name}`;

      setStage('uploading');
      await uploadFile(file.name, base64Content);

      setStage('recording');
      await recordUpload(text, s3Path);

      setStage('triggering');
      await triggerProcessing(`${S3_BUCKET}/${file.name}`, text);

      setStage('done');
      setMessage('All operations completed successfully!');
    } catch (error) {
      setStage('error');
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`An error occurred: ${detail}`);
    }
  };

  const isSubmitting = stage === 'uploading' || stage === 'recording' || stage === 'triggering';

  return (
    <div className="max-w-md mx-auto mt-10 p-4">
      <form onSubmit={handleSubmit}>
        <TextInput value={text} onChange={handleTextChange} />
        <FileInput onChange={handleFileChange} />
        <SubmitButton onClick={handleSubmit} disabled={isSubmitting} label={isSubmitting ? 'Processing…' : 'Submit'} />
      </form>
      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
}

export default UploadForm;
