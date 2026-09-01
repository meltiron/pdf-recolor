# PDF Recolor

A static, privacy-friendly PDF color converter built with Vite, TypeScript, PDF.js, and pdf-lib.

PDF Recolor lets you choose new paper and text colors, preview the result page-by-page, and export a recolored PDF without uploading the source document to a server.

## Features

- Drag-and-drop or choose a local PDF
- Live recolored page preview
- Previous/next page preview navigation
- Built-in color presets:
  - Original
  - Warm Paper
  - Sepia
  - Soft Gray
  - Cool Paper
  - Dark
  - Warm Dark
- Any custom background and text color via color picker or hex input
- Adjustable text/paper detection points
- Client-side conversion only
- One-page-at-a-time export to limit peak memory use
- Static-site friendly Vite build

## How it works

1. PDF.js opens and renders the PDF locally in the browser.
2. Neutral pixels are mapped between the chosen text and background colors. Clearly colored pixels are left alone where possible.
3. The preview uses the same recolor function as export.
4. On conversion, pages are rendered one at a time and embedded into a new PDF with pdf-lib.

## Important limitation

The current converter is intentionally a visual/raster converter. Exported pages are images inside the new PDF, so selectable/searchable source text is not preserved. This makes the first version work consistently across a wide range of PDFs, including scans and complex layouts.

## Development

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The generated `dist/` directory is a fully static site.

## Privacy

PDF files are processed in the browser. The app does not include a backend or upload PDF contents to a server.
