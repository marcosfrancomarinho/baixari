import { useEffect, useRef, useState } from 'react';
import { Alert } from './Alert';
import { convertFilesToPdf, type PdfConversionProgress } from '../services/pdf.converter';

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
    const added = Array.from(selected);
    const invalid = added.find((file) => !/\.(pdf|jpe?g|png)$/i.test(file.name));
    if (invalid) {
      setAlert({ message: 'Formato não aceito: ' + invalid.name + '. Selecione PDF, JPG, JPEG ou PNG.', type: 'error' });
      return;
    }
    setFiles((current) => [...current, ...added]);
    setAlert(null);
    if (input.current) input.current.value = '';
  };

  const moveFile = (index: number, offset: number) => {
    setFiles((current) => {
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
      const blob = await convertFilesToPdf(files, request.signal, setProgress);
      request.signal.throwIfAborted();
      savePdf(blob, 'documentos.pdf');
      setAlert({ message: 'PDF gerado no navegador. Download iniciado.', type: 'success' });
    } catch (error) {
      setAlert({
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'Conversão cancelada.'
          : error instanceof Error ? error.message : 'Não foi possível converter os documentos.',
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
          Adicione PDFs e imagens. A conversão acontece no seu navegador e os arquivos não são enviados ao servidor.
        </p>

        {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

        <label className='flex flex-col gap-1 text-sm font-medium'>
          Selecionar arquivos
          <input
            ref={input}
            type='file'
            accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
            multiple
            disabled={loading}
            onChange={(event) => addFiles(event.target.files)}
            className='w-full border border-gray-400 p-2 font-normal file:mr-3 file:border-0 file:bg-black file:px-3 file:py-2 file:text-white disabled:opacity-60'
          />
        </label>

        {files.length > 0 && (
          <div className='flex flex-col gap-2'>
            <div className='flex justify-between items-center'>
              <h3 className='text-sm font-medium'>Arquivos ({files.length})</h3>
              <button type='button' disabled={loading} onClick={() => setFiles([])} className='text-sm underline disabled:opacity-50'>Limpar lista</button>
            </div>
            <ol className='max-h-72 overflow-y-auto border border-gray-300 divide-y divide-gray-200'>
              {files.map((file, index) => (
                <li key={index + '-' + file.name} className='flex items-center gap-2 p-2 text-sm'>
                  <span className='shrink-0 text-gray-500'>{index + 1}.</span>
                  <span className='min-w-0 flex-1 truncate' title={file.name}>{file.name}</span>
                  <span className='shrink-0 text-gray-500'>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type='button' aria-label={'Mover ' + file.name + ' para cima'} title='Mover para cima' disabled={loading || index === 0} onClick={() => moveFile(index, -1)} className='px-1 disabled:opacity-30'>↑</button>
                  <button type='button' aria-label={'Mover ' + file.name + ' para baixo'} title='Mover para baixo' disabled={loading || index === files.length - 1} onClick={() => moveFile(index, 1)} className='px-1 disabled:opacity-30'>↓</button>
                  <button type='button' aria-label={'Remover ' + file.name} title='Remover' disabled={loading} onClick={() => setFiles((current) => current.filter((_, position) => position !== index))} className='px-1 text-red-700 disabled:opacity-30'>×</button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {loading && (
          <p role='status' className='text-sm text-gray-600'>
            {progress
              ? 'Processando ' + progress.current + ' de ' + progress.total + ': ' + progress.fileName
              : 'Preparando conversão local...'}
          </p>
        )}

        <button type='button' disabled={loading || files.length === 0} onClick={() => void convert()} className='bg-black text-white py-2 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed'>
          {loading ? 'Convertendo...' : 'Gerar PDF único'}
        </button>

        {loading && (
          <button type='button' onClick={() => controller.current?.abort()} className='border border-gray-400 py-2 font-medium'>
            Cancelar conversão
          </button>
        )}
      </div>
    </section>
  );
}
