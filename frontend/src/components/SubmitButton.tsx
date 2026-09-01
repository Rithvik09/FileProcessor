interface SubmitButtonProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  label?: string;
}

function SubmitButton({ onClick, disabled = false, label = 'Submit' }: SubmitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}

export default SubmitButton;
