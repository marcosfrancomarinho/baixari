import { useEffect, useRef, useState } from 'react';
import { convertFilesToPdfUseCase } from '../di/pdf-converter';
import type {
  PdfConversionProgress,
  PdfSourceFile,
} from '../modules/pdf-converter/domain/pdf-conversion';
import { Alert } from './Alert';

function savePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function toSourceFiles(files: readonly File[]): PdfSourceFile[] {
  return files.map(file => ({
    name: file.name,
    size: file.size,
    content: file,
  }));
}

function progressLabel(progress: PdfConversionProgress): string {
  if (progress.phase === 'saving') {
    return 'Finalizando o PDF...';
  }

  if (progress.phase === 'reading') {
    return 'Lendo ' + progress.current + ' de ' + progress.total + ': ' + progress.fileName;
  }

  return 'Convertendo ' + progress.current + ' de ' + progress.total + ': ' + progress.fileName;
}

export function ConvertForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<PdfConversionProgress | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;

    setFiles(current => [...current, ...Array.from(selected)]);
    setAlert(null);

    if (input.current) {
      input.current.value = '';
    }
  };

  const moveFile = (index: number, offset: number) => {
    setFiles(current => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  };

  const convert = async () => {
    if (!files.length || loading) return;

    setLoading(true);
    setProgress(null);
    setAlert(null);

    const request = new AbortController();
    controller.current = request;

    try {
      const blob = await convertFilesToPdfUseCase.execute({
        files: toSourceFiles(files),
        signal: request.signal,
        onProgress: setProgress,
      });

      request.signal.throwIfAborted();
      savePdf(blob, 'documentos.pdf');

      setAlert({
        message: 'PDF gerado no navegador. Download iniciado.',
        type: 'success',
      });
    } catch (error) {
      setAlert({
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'Conversão cancelada.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível converter os documentos.',
        type: 'error',
      });
    } finally {
      controller.current = null;
      setProgress(null);
      setLoading(false);
    }
  };

  return (
    <section className='w-full flex items-center justify-center px-4 py-10 bg-white text-black'>
      <div className='w-full max-w-xl border border-gray-300 p-6 flex flex-col gap-4 bg-white'>
        <h2 className='text-xl font-semibold text-center'>Converter documentos em PDF</h2>

        <p className='text-sm text-gray-600'>
          Adicione PDFs ou imagens. Arquivos com extensões como .001, .002 e .003 também são aceitos quando o conteúdo real é JPEG ou PNG. Nada é enviado ao servidor.
        </p>

        {alert && (
          <Alert
            message={alert.message}
            type={alert.type}
            onClose={() => setAlert(null)}
          />
        )}

        <label className='flex flex-col gap-1 text-sm font-medium'>
          Selecionar arquivos
          <input
            ref={input}
            type='file'
            multiple
            disabled={loading}
            onChange={event => addFiles(event.target.files)}
            className='w-full border border-gray-400 p-2 font-normal file:mr-3 file:border-0 file:bg-black file:px-3 file:py-2 file:text-white disabled:opacity-60'
          />
        </label>

        <p className='text-xs text-gray-500'>
          O formato é identificado pelo conteúdo do arquivo, não pelo nome ou extensão.
        </p>

        {files.length > 0 && (
          <div className='flex flex-col gap-2'>
            <div className='flex justify-between items-center'>
              <h3 className='text-sm font-medium'>Arquivos ({files.length})</h3>
              <button
                type='button'
                disabled={loading}
                onClick={() => setFiles([])}
                className='text-sm underline disabled:opacity-50'
              >
                Limpar lista
              </button>
            </div>

            <ol className='max-h-72 overflow-y-auto border border-gray-300 divide-y divide-gray-200'>
              {files.map((file, index) => (
                <li
                  key={index + '-' + file.name}
                  className='flex items-center gap-2 p-2 text-sm'
                >
                  <span className='shrink-0 text-gray-500'>{index + 1}.</span>
                  <span className='min-w-0 flex-1 truncate' title={file.name}>
                    {file.name}
                  </span>
                  <span className='shrink-0 text-gray-500'>
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type='button'
                    aria-label={'Mover ' + file.name + ' para cima'}
                    title='Mover para cima'
                    disabled={loading || index === 0}
                    onClick={() => moveFile(index, -1)}
                    className='px-1 disabled:opacity-30'
                  >
                    ↑
                  </button>
                  <button
                    type='button'
                    aria-label={'Mover ' + file.name + ' para baixo'}
                    title='Mover para baixo'
                    disabled={loading || index === files.length - 1}
                    onClick={() => moveFile(index, 1)}
                    className='px-1 disabled:opacity-30'
                  >
                    ↓
                  </button>
                  <button
                    type='button'
                    aria-label={'Remover ' + file.name}
                    title='Remover'
                    disabled={loading}
                    onClick={() => setFiles(current =>
                      current.filter((_, position) => position !== index)
                    )}
                    className='px-1 text-red-700 disabled:opacity-30'
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {loading && (
          <div className='flex flex-col gap-2' role='status' aria-live='polite'>
            <div className='flex items-center justify-between gap-4 text-sm text-gray-600'>
              <span className='min-w-0 truncate'>
                {progress ? progressLabel(progress) : 'Preparando conversão local...'}
              </span>
              <span className='shrink-0 font-medium'>
                {progress?.percent ?? 0}%
              </span>
            </div>

            <div
              className='h-2 w-full overflow-hidden bg-gray-200'
              role='progressbar'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress?.percent ?? 0}
            >
              <div
                className='h-full bg-black transition-[width] duration-150'
                style={{ width: (progress?.percent ?? 0) + '%' }}
              />
            </div>
          </div>
        )}

        <button
          type='button'
          disabled={loading || files.length === 0}
          onClick={() => void convert()}
          className='bg-black text-white py-2 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed'
        >
          {loading ? 'Convertendo...' : 'Gerar PDF único'}
        </button>

        {loading && (
          <button
            type='button'
            onClick={() => controller.current?.abort()}
            className='border border-gray-400 py-2 font-medium'
          >
            Cancelar conversão
          </button>
        )}
      </div>
    </section>
  );
}
