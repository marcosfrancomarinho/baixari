import type { PdfConversionGateway } from '../../application/contracts/pdf-conversion.gateway';
import type {
  PdfConversionInput,
  PdfConversionProgress,
} from '../../application/model/pdf-conversion';

interface WorkerProgressResponse {
  type: 'progress';
  progress: PdfConversionProgress;
}

interface WorkerDoneResponse {
  type: 'done';
  buffer: ArrayBuffer;
}

interface WorkerErrorResponse {
  type: 'error';
  message: string;
}

type WorkerResponse =
  | WorkerProgressResponse
  | WorkerDoneResponse
  | WorkerErrorResponse;

export class BrowserPdfConversionGateway implements PdfConversionGateway {
  public convert(input: PdfConversionInput): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('./pdf.converter.worker.ts', import.meta.url),
        { type: 'module' },
      );

      let settled = false;

      const finish = (action: () => void) => {
        if (settled) return;

        settled = true;
        input.signal?.removeEventListener('abort', abort);
        worker.terminate();
        action();
      };

      const abort = () => {
        finish(() => reject(
          new DOMException('Conversão cancelada.', 'AbortError'),
        ));
      };

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        if (message.type === 'progress') {
          input.onProgress?.(message.progress);
          return;
        }

        if (message.type === 'error') {
          finish(() => reject(new Error(message.message)));
          return;
        }

        finish(() => {
          input.onProgress?.({
            current: input.files.length,
            total: input.files.length,
            fileName: input.files.at(-1)?.name ?? '',
            phase: 'saving',
            percent: 100,
          });

          resolve(new Blob([message.buffer], {
            type: 'application/pdf',
          }));
        });
      };

      worker.onerror = () => {
        finish(() => reject(
          new Error('Falha no processador local de PDF.'),
        ));
      };

      if (input.signal?.aborted) {
        abort();
        return;
      }

      input.signal?.addEventListener('abort', abort, { once: true });

      worker.postMessage({
        type: 'convert',
        files: [...input.files],
      });
    });
  }
}
