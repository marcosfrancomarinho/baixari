import React from 'react';

type AlertProps = {
  message: string;
  type?: 'success' | 'error';
  onClose?: () => void;
};

export const Alert: React.FC<AlertProps> = ({ message, type = 'error', onClose }) => {
  return (
    <div
      className={`w-full border px-4 py-2 flex justify-between items-center
        ${type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : ''}
        ${type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : ''}
      `}
    >
      <span>{message}</span>

      {onClose && (
        <button onClick={onClose} className='font-bold'>
          ✕
        </button>
      )}
    </div>
  );
};
