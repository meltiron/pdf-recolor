import { loadPdfDocument, type PdfDocument } from './pdfRenderer';

// main.ts only sets this because PDF.js required a worker URL. Keep the same
// surface so the rest of the app does not need to know which renderer is used.
export const GlobalWorkerOptions = {
  workerSrc: '',
};

type GetDocumentOptions = {
  data: Uint8Array;
};

type LoadingTask = {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
};

export function getDocument({ data }: GetDocumentOptions): LoadingTask {
  let document: PdfDocument | null = null;
  let destroyed = false;

  const promise = loadPdfDocument(data).then(async (loaded) => {
    if (destroyed) {
      await loaded.destroy();
      throw new Error('PDF loading was cancelled.');
    }
    document = loaded;
    return loaded;
  });

  return {
    promise,
    async destroy(): Promise<void> {
      destroyed = true;
      if (document) {
        await document.destroy();
        document = null;
      }
    },
  };
}
