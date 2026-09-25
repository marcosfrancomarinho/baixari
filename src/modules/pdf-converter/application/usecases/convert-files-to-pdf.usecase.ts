import type { PdfConversionGateway } from '../contracts/pdf-conversion.gateway';
import type { PdfConversionInput } from '../model/pdf-conversion';

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const MAX_SINGLE_FILE_BYTES = 500 * MEBIBYTE;
const MAX_TOTAL_SOURCE_BYTES = GIBIBYTE;

export class ConvertFilesToPdfUseCase {
  private readonly pdfConversionGateway: PdfConversionGateway;

  public constructor(pdfConversionGateway: PdfConversionGateway) {
    this.pdfConversionGateway = pdfConversionGateway;
  }

  public execute(input: PdfConversionInput): Promise<Blob> {
    if (input.files.length === 0) {
      return Promise.reject(new Error('Adicione pelo menos um documento.'));
    }

    const oversized = input.files.find(file => file.size > MAX_SINGLE_FILE_BYTES);
    if (oversized) {
      return Promise.reject(new Error(
        'O arquivo ' + oversized.name + ' excede o limite de 500 MiB.',
      ));
    }

    const totalBytes = input.files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_TOTAL_SOURCE_BYTES) {
      return Promise.reject(new Error(
        'O conjunto selecionado excede 1 GiB. Divida a conversão em grupos menores para preservar a memória do navegador.',
      ));
    }

    input.signal?.throwIfAborted();
    return this.pdfConversionGateway.convert(input);
  }
}
