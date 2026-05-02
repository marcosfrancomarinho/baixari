import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className='bg-black text-white border-t border-gray-800'>
      <div className='max-w-7xl mx-auto px-6 py-6 flex flex-col items-center gap-2'>
        <span className='text-lg font-semibold'>
          Baixa<span className='text-gray-400'>RI</span>
        </span>
        <p className='text-sm text-gray-500'>© {new Date().getFullYear()} BaixaRI — Todos os direitos reservados</p>
      </div>
    </footer>
  );
};
