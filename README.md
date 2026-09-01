# PDF Recolor

A static, privacy-friendly PDF color converter built with Vite, TypeScript, PDF.js, and pdf-lib.

PDF Recolor lets you choose new paper and foreground colors, preview the result page-by-page, and export a recolored PDF without uploading the source document to a server.

**Live site:** https://meltiron.github.io/pdf-recolor/

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
- Any custom background and foreground color via color picker or hex input
- Adjustable dark/light detection points
- Client-side conversion only
- One-page-at-a-time export to limit peak memory use
- Automatic deployment to GitHub Pages from `main`

## How it works

1. PDF.js opens and renders the PDF locally in the browser.
2. The app analyzes the rendered pixels. It does not currently identify PDF text objects directly; the UI's "text color" control primarily affects dark, neutral foreground pixels.
3. Neutral pixels are remapped between the chosen foreground and background colors, while clearly colored pixels are left alone where possible.
4. The preview uses the same recolor function as export, so the exported result matches what you preview.
5. On conversion, pages are rendered one at a time and embedded into a new PDF with pdf-lib.

## Important limitation

The current converter is intentionally a visual/raster converter. Each exported page is a page-sized image inside the new PDF rather than a reconstruction of the original PDF text and drawing objects.

This means the visual appearance is preserved, but selectable/searchable source text, links, form fields, and other interactive PDF features are not preserved in the exported file.

This approach works with both normal PDFs and scanned/image-based PDFs without needing to interpret the PDF's internal text and drawing commands. A future vector/text-preserving mode could modify compatible PDF content directly while keeping the current raster method as a fallback.

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

## Deployment

The repository is configured to deploy to GitHub Pages automatically. Every push to `main` builds the Vite app and publishes the generated `dist/` directory.

## Privacy

PDF files are processed in the browser. The app does not include a backend or upload PDF contents to a server.
