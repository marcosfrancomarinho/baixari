import { PDFDocument } from 'pdf-lib';
import type {
  PdfConversionPhase,
  PdfConversionProgress,
  PdfSourceFile,
} from '../../domain/pdf-conversion';
import {
  detectDocumentKind,
  readImageDimensions,
  type BrowserDocumentKind,
} from './document.signature';

const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;
const MAX_SOURCE_IMAGE_PIXELS = 40_000_000;
const MAX_RENDER_PIXELS = 8_000_000;
const IMAGE_MAX_SIDE = 3000;
const JPEG_QUALITY = 0.9;
const CONVERSION_PERCENT_LIMIT = 94;

interface ConvertRequest {
  type: 'convert';
  files: PdfSourceFile[];
}

interface ProgressResponse {
  type: 'progress';
  progress: PdfConversionProgress;
}

interface DoneResponse {
  type: 'done';
  buffer: ArrayBuffer;
}

interface ErrorResponse {
  type: 'error';
  message: string;
}

type WorkerResponse = ProgressResponse | DoneResponse | ErrorResponse;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ConvertRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  if (event.data.type !== 'convert') return;

  void convert(event.data.files).catch((error: unknown) => {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error
        ? error.message
        : 'Não foi possível converter os documentos.',
    });
  });
};

async function convert(files: PdfSourceFile[]): Promise<void> {
  const output = await PDFDocument.create();

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const current = index + 1;

    sendProgress(
      current,
      files.length,
      file.name,
      'reading',
      progressFor(index, files.length, 0.05),
    );

    const kind = await detectDocumentKind(file.content);

    if (!kind) {
      throw new Error(
        'Formato não suportado em ' + file.name
        + '. A extensão pode ser .001, .002 ou outra, mas o conteúdo precisa ser PDF, JPEG ou PNG válido.',
      );
    }

    if (kind === 'pdf') {
      await appendPdf(
        output,
        file,
        fraction => sendProgress(
          current,
          files.length,
          file.name,
          'processing',
          progressFor(index, files.length, 0.1 + (fraction * 0.85)),
        ),
      );
    } else {
      await appendImage(
        output,
        file,
        kind,
        fraction => sendProgress(
          current,
          files.length,
          file.name,
          'processing',
          progressFor(index, files.length, 0.1 + (fraction * 0.85)),
        ),
      );
    }

    sendProgress(
      current,
      files.length,
      file.name,
      'processing',
      progressFor(index, files.length, 1),
    );

    await yieldToEventLoop();
  }

  if (output.getPageCount() === 0) {
    throw new Error('Os documentos não produziram um PDF válido.');
  }

  sendProgress(
    files.length,
    files.length,
    files.at(-1)?.name ?? '',
    'saving',
    97,
  );

  const bytes = await output.save();
  const buffer = toTransferableArrayBuffer(bytes);

  workerScope.postMessage({ type: 'done', buffer }, [buffer]);
}

async function appendPdf(
  output: PDFDocument,
  file: PdfSourceFile,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const inputBytes = await file.content.arrayBuffer();
  onProgress(0.15);

  const source = await PDFDocument.load(inputBytes, {
    updateMetadata: false,
  });

  const indices = source.getPageIndices();

  if (indices.length === 0) {
    throw new Error('O PDF ' + file.name + ' não possui páginas.');
  }

  const pages = await output.copyPages(source, indices);

  for (let index = 0; index < pages.length; index++) {
    output.addPage(pages[index]);
    onProgress(0.15 + (((index + 1) / pages.length) * 0.85));
  }
}

async function appendImage(
  output: PDFDocument,
  file: PdfSourceFile,
  kind: Extract<BrowserDocumentKind, 'png' | 'jpeg'>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const dimensions = await readImageDimensions(file.content, kind);
  const sourcePixels = dimensions.width * dimensions.height;

  if (!Number.isSafeInteger(sourcePixels) || sourcePixels > MAX_SOURCE_IMAGE_PIXELS) {
    throw new Error(
      'A imagem ' + file.name + ' excede o limite de 40 milhões de pixels.',
    );
  }

  onProgress(0.15);

  const scale = Math.min(
    IMAGE_MAX_SIDE / dimensions.width,
    IMAGE_MAX_SIDE / dimensions.height,
    Math.sqrt(MAX_RENDER_PIXELS / sourcePixels),
    1,
  );

  const targetWidth = Math.max(1, Math.round(dimensions.width * scale));
  const targetHeight = Math.max(1, Math.round(dimensions.height * scale));

  const bitmap = await createImageBitmap(file.content, {
    resizeWidth: targetWidth,
    resizeHeight: targetHeight,
    resizeQuality: 'high',
  });

  onProgress(0.45);

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);

  try {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'O navegador não conseguiu preparar a imagem ' + file.name + '.',
      );
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    onProgress(0.65);

    const jpegBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: JPEG_QUALITY,
    });

    const jpegBytes = await jpegBlob.arrayBuffer();
    const image = await output.embedJpg(jpegBytes);

    onProgress(0.82);

    const pageScale = Math.min(
      A4_WIDTH_POINTS / image.width,
      A4_HEIGHT_POINTS / image.height,
      1,
    );

    const pageWidth = image.width * pageScale;
    const pageHeight = image.height * pageScale;
    const page = output.addPage([pageWidth, pageHeight]);

    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    onProgress(1);
  } finally {
    bitmap.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}

function progressFor(index: number, total: number, fraction: number): number {
  const completed = index + Math.min(Math.max(fraction, 0), 1);

  return Math.min(
    CONVERSION_PERCENT_LIMIT,
    Math.max(0, Math.round((completed / total) * CONVERSION_PERCENT_LIMIT)),
  );
}

function sendProgress(
  current: number,
  total: number,
  fileName: string,
  phase: PdfConversionPhase,
  percent: number,
): void {
  workerScope.postMessage({
    type: 'progress',
    progress: {
      current,
      total,
      fileName,
      phase,
      percent,
    },
  });
}

function toTransferableArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer
    && bytes.byteOffset === 0
    && bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }

  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
