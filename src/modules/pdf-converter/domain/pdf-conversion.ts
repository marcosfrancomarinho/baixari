export type PdfConversionPhase = 'reading' | 'processing' | 'saving';

export interface PdfSourceFile {
  name: string;
  size: number;
  content: Blob;
}

export interface PdfConversionProgress {
  current: number;
  total: number;
  fileName: string;
  phase: PdfConversionPhase;
  percent: number;
}

export interface PdfConversionInput {
  files: readonly PdfSourceFile[];
  signal?: AbortSignal;
  onProgress?: (progress: PdfConversionProgress) => void;
}
