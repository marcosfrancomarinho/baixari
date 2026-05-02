import React from 'react';
import { Header } from './componets/Header';
import { Footer } from './componets/Footer';
import { DownloadForm } from './componets/DownloadForm';
export const App: React.FC = () => {
  return (
    <div className='h-screen flex flex-col'>
      <Header />
      <main className='grow'>
        <DownloadForm />
      </main>
      <Footer />
    </div>
  );
};
