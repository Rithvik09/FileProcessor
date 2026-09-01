interface FileInputProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function FileInput({ onChange }: FileInputProps) {
  return (
    <div>
      <label htmlFor="fileInput" className="block text-sm font-medium text-gray-700">
        File Input:
      </label>
      <input
        type="file"
        id="fileInput"
        onChange={onChange}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
    </div>
  );
}

export default FileInput;
