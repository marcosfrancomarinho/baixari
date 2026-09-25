import { ConvertFilesToPdfUseCase } from '../modules/pdf-converter/application/usecases/convert-files-to-pdf.usecase';
import { BrowserPdfConversionGateway } from '../modules/pdf-converter/infra/browser/browser-pdf-conversion.gateway';

const pdfConversionGateway = new BrowserPdfConversionGateway();

export const convertFilesToPdfUseCase = new ConvertFilesToPdfUseCase(
  pdfConversionGateway,
);
