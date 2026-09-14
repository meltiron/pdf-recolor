import { init, type WrappedPdfiumModule } from '@embedpdf/pdfium';
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

export type PdfViewport = {
  width: number;
  height: number;
};

type RenderOptions = {
  canvas: HTMLCanvasElement;
  canvasContext: CanvasRenderingContext2D;
  viewport: PdfViewport;
  background?: string;
};

type PdfiumHeap = {
  HEAPU8: Uint8Array;
};

export type PdfPage = {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: RenderOptions): { promise: Promise<void> };
  cleanup(): void;
};

export type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
};

const RENDER_FLAGS = 0x01 | 0x10; // annotations + RGBA byte order
let pdfiumPromise: Promise<WrappedPdfiumModule> | null = null;

async function getPdfium(): Promise<WrappedPdfiumModule> {
  pdfiumPromise ??= (async () => {
    const response = await fetch(pdfiumWasmUrl);
    if (!response.ok) {
      throw new Error(`Could not load PDF renderer (${response.status}).`);
    }

    const wasmBinary = await response.arrayBuffer();
    const pdfium = await init({ wasmBinary });
    pdfium.PDFiumExt_Init();
    return pdfium;
  })();

  return pdfiumPromise;
}

function getHeap(pdfium: WrappedPdfiumModule): Uint8Array {
  return (pdfium.pdfium as unknown as PdfiumHeap).HEAPU8;
}

function pdfErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Unknown PDF error';
    case 2:
      return 'PDF could not be opened';
    case 3:
      return 'File is not a valid PDF or is corrupted';
    case 4:
      return 'Password-protected PDFs are not supported yet';
    case 5:
      return 'Unsupported PDF security scheme';
    case 6:
      return 'PDF page or content could not be read';
    default:
      return `PDF renderer error ${code}`;
  }
}

export async function loadPdfDocument(data: Uint8Array): Promise<PdfDocument> {
  const pdfium = await getPdfium();
  const filePtr = pdfium.pdfium.wasmExports.malloc(data.length);
  // malloc can grow WASM memory, so fetch the heap view after allocating.
  getHeap(pdfium).set(data, filePtr);

  const docPtr = pdfium.FPDF_LoadMemDocument(filePtr, data.length, '');
  if (!docPtr) {
    const error = pdfium.FPDF_GetLastError();
    pdfium.pdfium.wasmExports.free(filePtr);
    throw new Error(pdfErrorMessage(error));
  }

  const numPages = pdfium.FPDF_GetPageCount(docPtr);
  const openPages = new Set<number>();
  let destroyed = false;

  return {
    numPages,

    async getPage(pageNumber: number): Promise<PdfPage> {
      if (destroyed) throw new Error('PDF has already been closed.');
      if (pageNumber < 1 || pageNumber > numPages) {
        throw new Error(`Invalid page ${pageNumber}.`);
      }

      const pagePtr = pdfium.FPDF_LoadPage(docPtr, pageNumber - 1);
      if (!pagePtr) throw new Error(`Could not open page ${pageNumber}.`);
      openPages.add(pagePtr);

      // PDFium reports the effective display dimensions, including /Rotate.
      const pageWidth = pdfium.FPDF_GetPageWidthF(pagePtr);
      const pageHeight = pdfium.FPDF_GetPageHeightF(pagePtr);
      let cleaned = false;

      const cleanup = (): void => {
        if (cleaned) return;
        cleaned = true;
        openPages.delete(pagePtr);
        pdfium.FPDF_ClosePage(pagePtr);
      };

      return {
        getViewport({ scale }): PdfViewport {
          return {
            width: pageWidth * scale,
            height: pageHeight * scale,
          };
        },

        render({ canvas, canvasContext, viewport }: RenderOptions): { promise: Promise<void> } {
          const promise = (async () => {
            if (cleaned) throw new Error(`Page ${pageNumber} has already been closed.`);

            const width = Math.max(1, Math.ceil(viewport.width));
            const height = Math.max(1, Math.ceil(viewport.height));
            const bitmapPtr = pdfium.FPDFBitmap_Create(width, height, 1);
            if (!bitmapPtr) throw new Error(`Could not allocate page ${pageNumber} bitmap.`);

            try {
              pdfium.FPDFBitmap_FillRect(bitmapPtr, 0, 0, width, height, 0xffffffff);
              pdfium.FPDF_RenderPageBitmap(
                bitmapPtr,
                pagePtr,
                0,
                0,
                width,
                height,
                0,
                RENDER_FLAGS,
              );

              const bufferPtr = pdfium.FPDFBitmap_GetBuffer(bitmapPtr);
              if (!bufferPtr) throw new Error(`Could not read page ${pageNumber} bitmap.`);

              const stride = pdfium.FPDFBitmap_GetStride(bitmapPtr);
              const heap = getHeap(pdfium);
              const pixels = new Uint8ClampedArray(width * height * 4);
              for (let y = 0; y < height; y += 1) {
                const sourceStart = bufferPtr + y * stride;
                pixels.set(
                  heap.subarray(sourceStart, sourceStart + width * 4),
                  y * width * 4,
                );
              }

              canvas.width = width;
              canvas.height = height;
              canvasContext.putImageData(new ImageData(pixels, width, height), 0, 0);
            } catch (error) {
              cleanup();
              throw error;
            } finally {
              pdfium.FPDFBitmap_Destroy(bitmapPtr);
            }
          })();

          return { promise };
        },

        cleanup,
      };
    },

    async destroy(): Promise<void> {
      if (destroyed) return;
      destroyed = true;
      for (const pagePtr of openPages) pdfium.FPDF_ClosePage(pagePtr);
      openPages.clear();
      pdfium.FPDF_CloseDocument(docPtr);
      pdfium.pdfium.wasmExports.free(filePtr);
    },
  };
}
