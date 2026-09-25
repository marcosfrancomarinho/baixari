import React, { useState } from 'react';
import { Header } from './componets/Header';
import { Footer } from './componets/Footer';
import { DownloadForm } from './componets/DownloadForm';
import { ConvertForm } from './componets/ConvertForm';
export const App: React.FC = () => {
  const [view, setView] = useState<'download' | 'convert'>('download');
  return (
    <div className='min-h-screen flex flex-col'>
      <Header />
      <main className='grow'>
        <nav className='flex justify-center gap-2 px-4 pt-6' aria-label='Funcionalidades'>
          <button type='button' aria-current={view === 'download' ? 'page' : undefined} onClick={() => setView('download')} className={`border px-4 py-2 ${view === 'download' ? 'bg-black text-white border-black' : 'border-gray-400'}`}>Consultar documentos</button>
          <button type='button' aria-current={view === 'convert' ? 'page' : undefined} onClick={() => setView('convert')} className={`border px-4 py-2 ${view === 'convert' ? 'bg-black text-white border-black' : 'border-gray-400'}`}>Converter para PDF</button>
        </nav>
        {view === 'download' ? <DownloadForm /> : <ConvertForm />}
      </main>
      <Footer />
    </div>
  );
};
