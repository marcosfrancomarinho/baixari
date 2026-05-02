import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className='bg-black text-white shadow-md'>
      <div className='max-w-7xl mx-auto px-6 py-4 flex items-center'>
        <h1 className='text-2xl font-bold tracking-wide'>
          Baixa<span className='text-gray-300'>RI</span>
        </h1>
      </div>
    </header>
  );
};
