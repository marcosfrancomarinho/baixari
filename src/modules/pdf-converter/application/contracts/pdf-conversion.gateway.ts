import type { PdfConversionInput } from '../../domain/pdf-conversion';

export interface PdfConversionGateway {
  convert(input: PdfConversionInput): Promise<Blob>;
}
