import React, { useState } from 'react';
import { Alert } from './Alert';

type DocumentType = 'protocolo' | 'certidao';

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    return data.error || 'Erro ao baixar o arquivo';
  } catch {
    return (await response.text()) || 'Erro ao baixar o arquivo';
  }
};

export const DownloadForm: React.FC = () => {
  const [type, setType] = useState<DocumentType>('protocolo');
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const handleDownload = async () => {
    const trimmed = number.trim();
    if (!trimmed) {
      setAlert({ message: 'Informe o número', type: 'error' });
      return;
    }

    setAlert(null);
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const endpoint =
        type === 'protocolo'
          ? `${baseUrl}/protocol/${encodeURIComponent(trimmed)}`
          : `${baseUrl}/certificate/${encodeURIComponent(trimmed)}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const blob = await response.blob();
      const filename = `${type}-${trimmed}.zip`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);

      setAlert({ message: 'Download iniciado com sucesso', type: 'success' });
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : 'Erro ao baixar arquivo',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && number.trim()) handleDownload();
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
          onKeyDown={handleKeyDown}
          disabled={loading}
          className='border border-gray-400 px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed'
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as DocumentType)}
          disabled={loading}
          className='border border-gray-400 px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed'
        >
          <option value='protocolo'>Protocolo</option>
          <option value='certidao'>Certidão</option>
        </select>

        <button
          onClick={handleDownload}
          disabled={!number.trim() || loading}
          className='bg-black text-white py-2 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
        >
          {loading && <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />}

          {loading ? 'Baixando...' : 'Baixar arquivo'}
        </button>
      </div>
    </div>
  );
};
