import React, { useRef, useState } from 'react';
import { Alert } from './Alert';

type DocumentType = 'protocolo' | 'certidao';
type DownloadFormat = 'zip' | 'pdf' | 'docx';

type PageEvent = {
  type: 'page';
  file: string;
  page: number;
  totalPages: number;
  text: string;
};

type StreamEvent =
  | { type: 'start' }
  | PageEvent
  | { type: 'done'; pages: number }
  | { type: 'error'; error: string };

type Progress = {
  file: string;
  page: number;
  totalPages: number;
  processedPages: number;
};

const getErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      return data.error || data.message || 'Erro ao processar o arquivo';
    } catch {
      return 'Erro ao processar o arquivo';
    }
  }

  return (await response.text()) || 'Erro ao processar o arquivo';
};

const getFilename = (
  response: Response,
  type: DocumentType,
  number: string,
  format: Exclude<DownloadFormat, 'docx'>,
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

const saveBlob = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

const createWord = async (pages: PageEvent[]): Promise<Blob> => {
  const { Document, HeadingLevel, Packer, Paragraph } = await import('docx');
  const children: InstanceType<typeof Paragraph>[] = [];
  let previousFile = '';

  for (const page of pages) {
    if (page.file !== previousFile) {
      children.push(
        new Paragraph({
          text: page.file,
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: children.length > 0,
        }),
      );
      previousFile = page.file;
    }

    children.push(new Paragraph({ text: `Página ${page.page}`, heading: HeadingLevel.HEADING_2 }));

    const text = page.text || '[Nenhum texto reconhecido nesta página.]';
    for (const line of text.split(/\r?\n/)) {
      children.push(new Paragraph({ text: line }));
    }
  }

  return Packer.toBlob(new Document({ sections: [{ children }] }));
};

const extractText = async (
  url: string,
  signal: AbortSignal,
  onPage: (page: PageEvent, processedPages: number) => void,
): Promise<PageEvent[]> => {
  const response = await fetch(url, { signal });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  if (!response.body) throw new Error('O navegador não oferece suporte à leitura progressiva.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const pages: PageEvent[] = [];
  let pending = '';
  let completed = false;

  const processLine = (line: string) => {
    if (!line.trim()) return;

    const event = JSON.parse(line) as StreamEvent;
    if (event.type === 'error') throw new Error(event.error);
    if (event.type === 'page') {
      pages.push(event);
      onPage(event, pages.length);
    }
    if (event.type === 'done') completed = true;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      let lineEnd = pending.indexOf('\n');

      while (lineEnd !== -1) {
        processLine(pending.slice(0, lineEnd));
        pending = pending.slice(lineEnd + 1);
        lineEnd = pending.indexOf('\n');
      }
    }

    pending += decoder.decode();
    if (pending.trim()) processLine(pending);
    if (!completed) throw new Error('A conexão terminou antes de concluir a extração.');

    return pages;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};

export const DownloadForm: React.FC = () => {
  const [type, setType] = useState<DocumentType>('protocolo');
  const [format, setFormat] = useState<DownloadFormat>('zip');
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const handleDownload = async () => {
    const trimmed = number.trim();
    if (!trimmed) {
      setAlert({ message: 'Informe o número', type: 'error' });
      return;
    }

    setAlert(null);
    setProgress(null);
    setLoading(true);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
      const resource = type === 'protocolo' ? 'protocol' : 'certificate';

      if (format === 'docx') {
        const controller = new AbortController();
        abortController.current = controller;
        const endpoint = `${baseUrl}/${resource}/${encodeURIComponent(trimmed)}/text`;
        const pages = await extractText(endpoint, controller.signal, (page, processedPages) => {
          setProgress({
            file: page.file,
            page: page.page,
            totalPages: page.totalPages,
            processedPages,
          });
        });
        const blob = await createWord(pages);
        saveBlob(blob, `${type}_${trimmed}.docx`);
      } else {
        const endpoint = `${baseUrl}/${resource}/${encodeURIComponent(trimmed)}?format=${format}`;
        const response = await fetch(endpoint);

        if (!response.ok) throw new Error(await getErrorMessage(response));

        saveBlob(await response.blob(), getFilename(response, type, trimmed, format));
      }

      setAlert({
        message: `Download em ${format.toUpperCase()} iniciado com sucesso`,
        type: 'success',
      });
    } catch (error) {
      setAlert({
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'Geração do DOCX cancelada'
            : error instanceof Error
              ? error.message
              : 'Erro ao processar arquivo',
        type: 'error',
      });
    } finally {
      abortController.current = null;
      setLoading(false);
      setProgress(null);
    }
  };

  const handleCancel = () => abortController.current?.abort();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !loading && number.trim()) void handleDownload();
  };

  const loadingLabel =
    format === 'docx' && progress
      ? `Extraindo página ${progress.page} de ${progress.totalPages}...`
      : format === 'docx'
        ? 'Preparando DOCX...'
        : 'Baixando...';

  return (
    <div className='w-full flex items-center justify-center px-4 py-10 bg-white text-black'>
      <div className='w-full max-w-md border border-gray-300 p-6 flex flex-col gap-4 bg-white'>
        <h2 className='text-xl font-semibold text-center'>Download de Arquivo</h2>

        {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

        <label className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>Número</span>
          <input
            type='text'
            inputMode='numeric'
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
          <div className='grid grid-cols-3 gap-2'>
            {(['zip', 'pdf', 'docx'] as const).map((option) => (
              <label
                key={option}
                className={`border px-3 py-2 text-center cursor-pointer transition-colors ${
                  format === option ? 'border-black bg-black text-white' : 'border-gray-400 bg-white text-black'
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

        {loading && format === 'docx' && progress && (
          <div className='border border-gray-300 bg-gray-50 p-3 text-sm' aria-live='polite'>
            <p className='font-medium truncate' title={progress.file}>{progress.file}</p>
            <p>Página {progress.page} de {progress.totalPages} · {progress.processedPages} processada(s)</p>
          </div>
        )}

        <button
          onClick={() => void handleDownload()}
          disabled={!number.trim() || loading}
          className='bg-black text-white py-2 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
        >
          {loading && <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />}
          {loading ? loadingLabel : `Baixar ${format.toUpperCase()}`}
        </button>

        {loading && format === 'docx' && (
          <button
            type='button'
            onClick={handleCancel}
            className='border border-gray-400 py-2 font-medium hover:bg-gray-100 transition-colors'
          >
            Cancelar geração
          </button>
        )}
      </div>
    </div>
  );
};
