export type BrowserDocumentKind = 'pdf' | 'png' | 'jpeg';

export interface ImageDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const JPEG_HEADER_SCAN_BYTES = 2 * 1024 * 1024;
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

export async function detectDocumentKind(content: Blob): Promise<BrowserDocumentKind | null> {
  const signature = new Uint8Array(await content.slice(0, 8).arrayBuffer());

  if (
    signature.length >= 5
    && String.fromCharCode(...signature.slice(0, 5)) === '%PDF-'
  ) {
    return 'pdf';
  }

  if (
    signature.length >= PNG_SIGNATURE.length
    && PNG_SIGNATURE.every((byte, index) => signature[index] === byte)
  ) {
    return 'png';
  }

  if (
    signature.length >= 3
    && signature[0] === 0xff
    && signature[1] === 0xd8
    && signature[2] === 0xff
  ) {
    return 'jpeg';
  }

  return null;
}

export async function readImageDimensions(
  content: Blob,
  kind: Extract<BrowserDocumentKind, 'png' | 'jpeg'>,
): Promise<ImageDimensions> {
  return kind === 'png'
    ? readPngDimensions(content)
    : readJpegDimensions(content);
}

async function readPngDimensions(content: Blob): Promise<ImageDimensions> {
  const bytes = new Uint8Array(await content.slice(0, 24).arrayBuffer());

  if (bytes.length < 24) {
    throw new Error('PNG incompleto ou inválido.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  if (width === 0 || height === 0) {
    throw new Error('PNG com dimensões inválidas.');
  }

  return { width, height };
}

async function readJpegDimensions(content: Blob): Promise<ImageDimensions> {
  const scanSize = Math.min(content.size, JPEG_HEADER_SCAN_BYTES);
  const bytes = new Uint8Array(await content.slice(0, scanSize).arrayBuffer());

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('JPEG inválido.');
  }

  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset++;
    }

    if (offset >= bytes.length) break;

    const marker = bytes[offset++];

    if (marker === 0xd9 || marker === 0xda) break;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 1 >= bytes.length) break;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2) break;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 6 >= bytes.length) break;

      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];

      if (width === 0 || height === 0) {
        throw new Error('JPEG com dimensões inválidas.');
      }

      return { width, height };
    }

    offset += segmentLength;
  }

  throw new Error('Não foi possível ler as dimensões do JPEG sem decodificá-lo.');
}
