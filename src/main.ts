import './style.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  normalizeHex,
  recolorImageData,
  type RecolorSettings,
} from './recolor';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ThemePreset = {
  name: string;
  background: string;
  text: string;
};

const presets: ThemePreset[] = [
  { name: 'Original', background: '#FFFFFF', text: '#000000' },
  { name: 'Warm Paper', background: '#F4ECD8', text: '#3E382F' },
  { name: 'Sepia', background: '#E8D8B5', text: '#4A3B2A' },
  { name: 'Soft Gray', background: '#E8E8E8', text: '#333333' },
  { name: 'Cool Paper', background: '#E9EEF2', text: '#263238' },
  { name: 'Dark', background: '#1E1E1E', text: '#E6E6E6' },
  { name: 'Warm Dark', background: '#24211D', text: '#E8DCC8' },
];

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found.');

app.innerHTML = `
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Local PDF color converter</p>
        <h1>PDF Recolor</h1>
        <p class="hero-copy">
          Change paper and text colors, preview the result, then export a new PDF.
          Your file stays in your browser.
        </p>
      </div>
      <span class="privacy-badge" title="No PDF upload or server processing">100% local</span>
    </header>

    <section class="upload-card" aria-labelledby="upload-title">
      <div id="drop-zone" class="drop-zone" role="button" tabindex="0">
        <input id="pdf-input" class="visually-hidden" type="file" accept="application/pdf,.pdf" />
        <div class="drop-icon" aria-hidden="true">PDF</div>
        <div>
          <h2 id="upload-title">Drop a PDF here</h2>
          <p>or choose one from your device</p>
        </div>
        <button id="choose-file" class="secondary-button" type="button">Choose PDF</button>
      </div>
      <div id="file-summary" class="file-summary" hidden>
        <div>
          <strong id="file-name"></strong>
          <span id="file-meta"></span>
        </div>
        <button id="replace-file" class="text-button" type="button">Replace</button>
      </div>
    </section>

    <section id="workspace" class="workspace" hidden>
      <aside class="controls-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Colors</p>
            <h2>Choose a palette</h2>
          </div>
        </div>

        <div id="preset-grid" class="preset-grid" aria-label="Color presets"></div>

        <div class="custom-colors">
          <h3>Custom colors</h3>
          <div class="color-row">
            <label for="background-color">Background</label>
            <div class="color-controls">
              <input id="background-color" type="color" value="#FFFFFF" aria-label="Background color picker" />
              <input id="background-hex" class="hex-input" type="text" value="#FFFFFF" maxlength="7" spellcheck="false" aria-label="Background hex color" />
            </div>
          </div>
          <div class="color-row">
            <label for="text-color">Text</label>
            <div class="color-controls">
              <input id="text-color" type="color" value="#000000" aria-label="Text color picker" />
              <input id="text-hex" class="hex-input" type="text" value="#000000" maxlength="7" spellcheck="false" aria-label="Text hex color" />
            </div>
          </div>
        </div>

        <details class="advanced-controls">
          <summary>Detection controls</summary>
          <p class="control-help">
            Use these if light paper or dark text is not being detected strongly enough.
          </p>
          <label class="slider-row" for="dark-point">
            <span>Text point <output id="dark-value">0</output></span>
            <input id="dark-point" type="range" min="0" max="254" value="0" />
          </label>
          <label class="slider-row" for="light-point">
            <span>Paper point <output id="light-value">255</output></span>
            <input id="light-point" type="range" min="1" max="255" value="255" />
          </label>
        </details>

        <button id="convert-button" class="primary-button" type="button">Convert PDF</button>
        <div id="progress-wrap" class="progress-wrap" hidden>
          <div class="progress-track" aria-hidden="true"><div id="progress-bar" class="progress-bar"></div></div>
          <span id="progress-text" aria-live="polite"></span>
        </div>
        <p id="status" class="status" role="status" aria-live="polite"></p>
      </aside>

      <section class="preview-card" aria-labelledby="preview-title">
        <div class="preview-toolbar">
          <div>
            <p class="eyebrow">Live preview</p>
            <h2 id="preview-title">Before you convert</h2>
          </div>
          <div class="page-controls">
            <button id="previous-page" class="icon-button" type="button" aria-label="Previous page">←</button>
            <span id="page-label">Page 1 of 1</span>
            <button id="next-page" class="icon-button" type="button" aria-label="Next page">→</button>
          </div>
        </div>
        <div id="preview-stage" class="preview-stage">
          <div id="preview-loading" class="preview-loading">Rendering preview…</div>
          <canvas id="preview-canvas" aria-label="Recolored PDF page preview"></canvas>
        </div>
      </section>
    </section>
  </main>
`;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const pdfInput = getElement<HTMLInputElement>('pdf-input');
const dropZone = getElement<HTMLDivElement>('drop-zone');
const chooseFileButton = getElement<HTMLButtonElement>('choose-file');
const replaceFileButton = getElement<HTMLButtonElement>('replace-file');
const fileSummary = getElement<HTMLDivElement>('file-summary');
const fileNameElement = getElement<HTMLElement>('file-name');
const fileMetaElement = getElement<HTMLElement>('file-meta');
const workspace = getElement<HTMLElement>('workspace');
const presetGrid = getElement<HTMLDivElement>('preset-grid');
const backgroundColor = getElement<HTMLInputElement>('background-color');
const backgroundHex = getElement<HTMLInputElement>('background-hex');
const textColor = getElement<HTMLInputElement>('text-color');
const textHex = getElement<HTMLInputElement>('text-hex');
const darkPoint = getElement<HTMLInputElement>('dark-point');
const lightPoint = getElement<HTMLInputElement>('light-point');
const darkValue = getElement<HTMLOutputElement>('dark-value');
const lightValue = getElement<HTMLOutputElement>('light-value');
const convertButton = getElement<HTMLButtonElement>('convert-button');
const progressWrap = getElement<HTMLDivElement>('progress-wrap');
const progressBar = getElement<HTMLDivElement>('progress-bar');
const progressText = getElement<HTMLElement>('progress-text');
const statusElement = getElement<HTMLElement>('status');
const previousPageButton = getElement<HTMLButtonElement>('previous-page');
const nextPageButton = getElement<HTMLButtonElement>('next-page');
const pageLabel = getElement<HTMLElement>('page-label');
const previewCanvas = getElement<HTMLCanvasElement>('preview-canvas');
const previewLoading = getElement<HTMLDivElement>('preview-loading');

let pdf: PDFDocumentProxy | null = null;
let currentFileName = '';
let currentPage = 1;
let previewSource: ImageData | null = null;
let previewFrame = 0;
let renderVersion = 0;
let converting = false;

function currentSettings(): RecolorSettings {
  return {
    background: backgroundColor.value.toUpperCase(),
    text: textColor.value.toUpperCase(),
    darkPoint: Number(darkPoint.value),
    lightPoint: Number(lightPoint.value),
  };
}

function buildPresets(): void {
  presetGrid.innerHTML = '';
  for (const preset of presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-button';
    button.dataset.background = preset.background;
    button.dataset.text = preset.text;
    button.innerHTML = `
      <span class="preset-sample" style="background:${preset.background};color:${preset.text}">Aa</span>
      <span>${preset.name}</span>
    `;
    button.addEventListener('click', () => {
      setColor('background', preset.background);
      setColor('text', preset.text);
      updatePresetSelection();
      schedulePreviewRecolor();
    });
    presetGrid.append(button);
  }
  updatePresetSelection();
}

function updatePresetSelection(): void {
  const background = backgroundColor.value.toUpperCase();
  const text = textColor.value.toUpperCase();
  for (const button of presetGrid.querySelectorAll<HTMLButtonElement>('.preset-button')) {
    const selected =
      button.dataset.background?.toUpperCase() === background &&
      button.dataset.text?.toUpperCase() === text;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

function setColor(target: 'background' | 'text', value: string): boolean {
  const normalized = normalizeHex(value);
  if (!normalized) return false;

  const picker = target === 'background' ? backgroundColor : textColor;
  const input = target === 'background' ? backgroundHex : textHex;
  picker.value = normalized;
  input.value = normalized;
  input.classList.remove('is-invalid');
  return true;
}

function handleHexInput(target: 'background' | 'text', input: HTMLInputElement): void {
  const normalized = normalizeHex(input.value);
  if (!normalized) {
    input.classList.add('is-invalid');
    return;
  }

  setColor(target, normalized);
  updatePresetSelection();
  schedulePreviewRecolor();
}

function clampDetectionPoints(changed: 'dark' | 'light'): void {
  let dark = Number(darkPoint.value);
  let light = Number(lightPoint.value);

  if (dark >= light) {
    if (changed === 'dark') {
      light = Math.min(255, dark + 1);
      lightPoint.value = String(light);
    } else {
      dark = Math.max(0, light - 1);
      darkPoint.value = String(dark);
    }
  }

  darkValue.value = darkPoint.value;
  lightValue.value = lightPoint.value;
  schedulePreviewRecolor();
}

function schedulePreviewRecolor(): void {
  if (!previewSource) return;
  cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(applyPreviewRecolor);
}

function applyPreviewRecolor(): void {
  if (!previewSource) return;
  const context = previewCanvas.getContext('2d');
  if (!context) return;
  context.putImageData(recolorImageData(previewSource, currentSettings()), 0, 0);
}

function updatePageControls(): void {
  const totalPages = pdf?.numPages ?? 1;
  pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  previousPageButton.disabled = converting || currentPage <= 1;
  nextPageButton.disabled = converting || currentPage >= totalPages;
}

async function renderPreview(): Promise<void> {
  if (!pdf) return;

  const version = ++renderVersion;
  previewLoading.hidden = false;
  previewCanvas.classList.add('is-loading');
  previewSource = null;
  updatePageControls();

  try {
    const page = await pdf.getPage(currentPage);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2,
      1500 / Math.max(1, baseViewport.width),
      1900 / Math.max(1, baseViewport.height),
    );
    const viewport = page.getViewport({ scale });
    const context = previewCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is not available in this browser.');

    previewCanvas.width = Math.max(1, Math.ceil(viewport.width));
    previewCanvas.height = Math.max(1, Math.ceil(viewport.height));

    await page.render({
      canvasContext: context,
      viewport,
      background: '#FFFFFF',
    }).promise;

    if (version !== renderVersion) return;
    previewSource = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
    applyPreviewRecolor();
    page.cleanup();
  } catch (error) {
    if (version !== renderVersion) return;
    setStatus(error instanceof Error ? error.message : 'Could not render this page.', true);
  } finally {
    if (version === renderVersion) {
      previewLoading.hidden = true;
      previewCanvas.classList.remove('is-loading');
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadPdf(file: File): Promise<void> {
  if (converting) return;
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    setStatus('Please choose a PDF file.', true);
    return;
  }

  setStatus('Opening PDF…');
  workspace.hidden = true;

  try {
    if (pdf) {
      await pdf.destroy();
      pdf = null;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    pdf = await loadingTask.promise;
    currentFileName = file.name;
    currentPage = 1;

    fileNameElement.textContent = file.name;
    fileMetaElement.textContent = `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} · ${formatBytes(file.size)}`;
    fileSummary.hidden = false;
    dropZone.hidden = true;
    workspace.hidden = false;
    convertButton.disabled = false;
    setStatus('');
    await renderPreview();
  } catch (error) {
    workspace.hidden = true;
    dropZone.hidden = false;
    fileSummary.hidden = true;
    setStatus(error instanceof Error ? `Could not open PDF: ${error.message}` : 'Could not open this PDF.', true);
  } finally {
    pdfInput.value = '';
  }
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle('is-error', isError);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode a PDF page.'));
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function outputFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.pdf$/i, '') || 'document';
  return `${withoutExtension}-recolored.pdf`;
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function convertPdf(): Promise<void> {
  if (!pdf || converting) return;

  converting = true;
  convertButton.disabled = true;
  replaceFileButton.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = '0%';
  setStatus('');
  updatePageControls();

  const settings = currentSettings();
  const output = await PDFDocument.create();
  const renderCanvas = document.createElement('canvas');
  const maxPixels = 24_000_000;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const sourcePage = await pdf.getPage(pageNumber);
      const baseViewport = sourcePage.getViewport({ scale: 1 });
      const safeScale = Math.sqrt(
        maxPixels / Math.max(1, baseViewport.width * baseViewport.height),
      );
      const scale = Math.min(2, safeScale);
      const viewport = sourcePage.getViewport({ scale });
      const context = renderCanvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas is not available in this browser.');

      renderCanvas.width = Math.max(1, Math.ceil(viewport.width));
      renderCanvas.height = Math.max(1, Math.ceil(viewport.height));

      await sourcePage.render({
        canvasContext: context,
        viewport,
        background: '#FFFFFF',
      }).promise;

      const source = context.getImageData(0, 0, renderCanvas.width, renderCanvas.height);
      context.putImageData(recolorImageData(source, settings), 0, 0);

      const pngBlob = await canvasToPng(renderCanvas);
      const png = await output.embedPng(await pngBlob.arrayBuffer());
      const outputPage = output.addPage([baseViewport.width, baseViewport.height]);
      outputPage.drawImage(png, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });

      sourcePage.cleanup();
      const progress = Math.round((pageNumber / pdf.numPages) * 100);
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `Processing page ${pageNumber} of ${pdf.numPages} · ${progress}%`;
      await yieldToBrowser();
    }

    progressText.textContent = 'Finishing PDF…';
    const bytes = await output.save({ useObjectStreams: true });
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    downloadBlob(blob, outputFileName(currentFileName));
    progressBar.style.width = '100%';
    progressText.textContent = 'Done — your recolored PDF was downloaded.';
    setStatus('Conversion complete.');
  } catch (error) {
    setStatus(error instanceof Error ? `Conversion failed: ${error.message}` : 'Conversion failed.', true);
    progressText.textContent = 'Conversion stopped.';
  } finally {
    renderCanvas.width = 0;
    renderCanvas.height = 0;
    converting = false;
    convertButton.disabled = false;
    replaceFileButton.disabled = false;
    updatePageControls();
  }
}

function openFilePicker(): void {
  if (!converting) pdfInput.click();
}

chooseFileButton.addEventListener('click', (event) => {
  event.stopPropagation();
  openFilePicker();
});
replaceFileButton.addEventListener('click', openFilePicker);
dropZone.addEventListener('click', openFilePicker);
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openFilePicker();
  }
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
}
dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) void loadPdf(file);
});
pdfInput.addEventListener('change', () => {
  const file = pdfInput.files?.[0];
  if (file) void loadPdf(file);
});

backgroundColor.addEventListener('input', () => {
  setColor('background', backgroundColor.value);
  updatePresetSelection();
  schedulePreviewRecolor();
});
textColor.addEventListener('input', () => {
  setColor('text', textColor.value);
  updatePresetSelection();
  schedulePreviewRecolor();
});
backgroundHex.addEventListener('input', () => handleHexInput('background', backgroundHex));
textHex.addEventListener('input', () => handleHexInput('text', textHex));
backgroundHex.addEventListener('blur', () => {
  if (!setColor('background', backgroundHex.value)) backgroundHex.value = backgroundColor.value.toUpperCase();
});
textHex.addEventListener('blur', () => {
  if (!setColor('text', textHex.value)) textHex.value = textColor.value.toUpperCase();
});
darkPoint.addEventListener('input', () => clampDetectionPoints('dark'));
lightPoint.addEventListener('input', () => clampDetectionPoints('light'));

previousPageButton.addEventListener('click', () => {
  if (!pdf || currentPage <= 1) return;
  currentPage -= 1;
  void renderPreview();
});
nextPageButton.addEventListener('click', () => {
  if (!pdf || currentPage >= pdf.numPages) return;
  currentPage += 1;
  void renderPreview();
});
convertButton.addEventListener('click', () => void convertPdf());

buildPresets();
clampDetectionPoints('dark');
