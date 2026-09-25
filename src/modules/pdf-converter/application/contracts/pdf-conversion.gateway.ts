import type { PdfConversionInput } from '../model/pdf-conversion';

export interface PdfConversionGateway {
  convert(input: PdfConversionInput): Promise<Blob>;
}
