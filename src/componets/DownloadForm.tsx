import React, { useState } from 'react';
import { Alert } from './Alert';

export const DownloadForm: React.FC = () => {
  const [type, setType] = useState<'protocolo' | 'certidao'>('protocolo');
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const getErrorMessage = async (response: Response) => {
    try {
      const data = await response.json();
      return data.error || 'Erro ao baixar o arquivo';
    } catch {
      const text = await response.text();
      return text || 'Erro ao baixar o arquivo';
    }
  };

  const handleDownload = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      if (!number || number.trim().length === 0) throw new Error('Informe o número');
      const url = type === 'protocolo' ? `${baseUrl}/protocol/${number}` : `${baseUrl}/certificate/${number}`;
      setLoading(true);
      const response = await fetch(url);
      if (!response.ok) throw new Error(await getErrorMessage(response));
      response.body?.cancel();
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.click();
      setAlert({ message: 'Download iniciado', type: 'success' });
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : 'Erro ao baixar arquivo',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-full flex items-center justify-center px-4 py-10 bg-white text-black'>
      <div className='w-full max-w-md border border-gray-300 p-6 flex flex-col gap-4 bg-white'>
        <h2 className='text-xl font-semibold text-center'>Download de Arquivo</h2>

        {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

        <input
          type='text'
          placeholder='Informe o número'
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className='border border-gray-400 px-3 py-2'
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'protocolo' | 'certidao')}
          className='border border-gray-400 px-3 py-2'
        >
          <option value='protocolo'>Protocolo</option>
          <option value='certidao'>Certidão</option>
        </select>

        <button
          onClick={handleDownload}
          disabled={!number || loading}
          className='bg-black text-white py-2 font-semibold disabled:bg-gray-400'
        >
          {loading ? 'Validando...' : 'Baixar arquivo'}
        </button>
      </div>
    </div>
  );
};
