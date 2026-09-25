import { PDFDocument } from 'pdf-lib';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;
const MAX_IMAGE_PIXELS = 40_000_000;
const IMAGE_MAX_SIDE = 3000;
const JPEG_QUALITY = 0.9;

export interface PdfConversionProgress {
  current: number;
  total: number;
  fileName: string;
}

type PdfConversionProgressHandler = (progress: PdfConversionProgress) => void;

export async function convertFilesToPdf(
  files: readonly File[],
  signal?: AbortSignal,
  onProgress?: PdfConversionProgressHandler,
): Promise<Blob> {
  if (files.length === 0) {
    throw new Error('Adicione pelo menos um documento.');
  }

  const output = await PDFDocument.create();

  for (let index = 0; index < files.length; index++) {
    signal?.throwIfAborted();
    const file = files[index];

    onProgress?.({
      current: index + 1,
      total: files.length,
      fileName: file.name,
    });

    const kind = await identifyDocument(file);

    if (kind === 'pdf') {
      await appendPdf(output, file, signal);
    } else {
      await appendImage(output, file, signal);
    }
  }

  signal?.throwIfAborted();

  if (output.getPageCount() === 0) {
    throw new Error('Os documentos não produziram um PDF válido.');
  }

  const bytes = await output.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  return new Blob([buffer], { type: 'application/pdf' });
}

async function identifyDocument(file: File): Promise<'pdf' | 'image'> {
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  const isPdf = signature.length >= 5
    && String.fromCharCode(...signature.slice(0, 5)) === '%PDF-';

  if (isPdf) return 'pdf';

  const isPng = signature.length >= PNG_SIGNATURE.length
    && PNG_SIGNATURE.every((byte, index) => signature[index] === byte);

  if (isPng) return 'image';

  const isJpeg = signature.length >= 3
    && signature[0] === 0xff
    && signature[1] === 0xd8
    && signature[2] === 0xff;

  if (isJpeg) return 'image';

  throw new Error('Formato não suportado em ' + file.name + '. Use PDF, JPG, JPEG ou PNG.');
}

async function appendPdf(output: PDFDocument, file: File, signal?: AbortSignal): Promise<void> {
  const bytes = await file.arrayBuffer();
  signal?.throwIfAborted();

  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = await output.copyPages(source, source.getPageIndices());

  for (const page of pages) {
    signal?.throwIfAborted();
    output.addPage(page);
  }
}

async function appendImage(output: PDFDocument, file: File, signal?: AbortSignal): Promise<void> {
  const bitmap = await createImageBitmap(file);

  try {
    signal?.throwIfAborted();

    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error('A imagem ' + file.name + ' excede o limite de 40 milhões de pixels.');
    }

    const resizeScale = Math.min(
      IMAGE_MAX_SIDE / bitmap.width,
      IMAGE_MAX_SIDE / bitmap.height,
      1,
    );

    const width = Math.max(1, Math.round(bitmap.width * resizeScale));
    const height = Math.max(1, Math.round(bitmap.height * resizeScale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('O navegador não conseguiu preparar a imagem ' + file.name + '.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const jpegBlob = await canvasToBlob(canvas);
    signal?.throwIfAborted();

    const jpeg = await output.embedJpg(await jpegBlob.arrayBuffer());
    const pageScale = Math.min(
      A4_WIDTH_POINTS / jpeg.width,
      A4_HEIGHT_POINTS / jpeg.height,
      1,
    );

    const pageWidth = jpeg.width * pageScale;
    const pageHeight = jpeg.height * pageScale;
    const page = output.addPage([pageWidth, pageHeight]);

    page.drawImage(jpeg, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem para PDF.')),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
