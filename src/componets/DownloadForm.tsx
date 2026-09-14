import React, { useState } from 'react';
import { Alert } from './Alert';

type DocumentType = 'protocolo' | 'certidao';
type DownloadFormat = 'zip' | 'pdf';

const getErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      return data.error || data.message || 'Erro ao baixar o arquivo';
    } catch {
      return 'Erro ao baixar o arquivo';
    }
  }

  return (await response.text()) || 'Erro ao baixar o arquivo';
};

const getFilename = (
  response: Response,
  type: DocumentType,
  number: string,
  format: DownloadFormat,
): string => {
  const contentDisposition = response.headers.get('content-disposition');
  const encodedFilename = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainFilename = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  const headerFilename = encodedFilename || plainFilename;

  if (headerFilename) {
    try {
      return decodeURIComponent(headerFilename);
    } catch {
      return headerFilename;
    }
  }

  return `${type}-${number}.${format}`;
};

export const DownloadForm: React.FC = () => {
  const [type, setType] = useState<DocumentType>('protocolo');
  const [format, setFormat] = useState<DownloadFormat>('zip');
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
      const resource = type === 'protocolo' ? 'protocol' : 'certificate';
      const endpoint = `${baseUrl}/${resource}/${encodeURIComponent(trimmed)}?format=${format}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const blob = await response.blob();
      const filename = getFilename(response, type, trimmed, format);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);

      setAlert({
        message: `Download em ${format.toUpperCase()} iniciado com sucesso`,
        type: 'success',
      });
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : 'Erro ao baixar arquivo',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !loading && number.trim()) {
      void handleDownload();
    }
  };

  return (
    <div className='w-full flex items-center justify-center px-4 py-10 bg-white text-black'>
      <div className='w-full max-w-md border border-gray-300 p-6 flex flex-col gap-4 bg-white'>
        <h2 className='text-xl font-semibold text-center'>Download de Arquivo</h2>

        {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

        <label className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>Número</span>
          <input
            type='text'
            placeholder='Informe o número'
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className='border border-gray-400 px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed'
          />
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>Tipo de documento</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
            disabled={loading}
            className='border border-gray-400 px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed'
          >
            <option value='protocolo'>Pedido do protocolo</option>
            <option value='certidao'>Certidão</option>
          </select>
        </label>

        <fieldset className='flex flex-col gap-2' disabled={loading}>
          <legend className='text-sm font-medium mb-1'>Formato do download</legend>
          <div className='grid grid-cols-2 gap-2'>
            {(['zip', 'pdf'] as const).map((option) => (
              <label
                key={option}
                className={`border px-3 py-2 text-center cursor-pointer transition-colors ${
                  format === option
                    ? 'border-black bg-black text-white'
                    : 'border-gray-400 bg-white text-black'
                } ${loading ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type='radio'
                  name='format'
                  value={option}
                  checked={format === option}
                  onChange={() => setFormat(option)}
                  className='sr-only'
                />
                {option.toUpperCase()}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          onClick={() => void handleDownload()}
          disabled={!number.trim() || loading}
          className='bg-black text-white py-2 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
        >
          {loading && (
            <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
          )}

          {loading ? 'Baixando...' : `Baixar ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
};
