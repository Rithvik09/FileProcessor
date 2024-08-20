import React from 'react';

const TextInput = ({ value, onChange }) => {
  return (
    <div>
      <label htmlFor="textInput" className="block text-sm font-medium text-gray-700">
        Text Input:
      </label>
      <input
        type="text"
        id="textInput"
        value={value}
        onChange={onChange}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
    </div>
  );
};

export default TextInput;
