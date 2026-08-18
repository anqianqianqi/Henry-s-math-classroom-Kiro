/*
  Copy the pdf.js worker into public/.

  The page sets GlobalWorkerOptions.workerSrc to a static path rather than
  resolving it through `new URL(..., import.meta.url)`: pdfjs-dist is ESM, and
  import.meta inside a 'use client' module breaks the server compile of the
  page. A static file needs to exist, and a file copied by hand is a second
  copy of the library that no lockfile watches — it goes stale silently the
  first time pdfjs is upgraded. So it is copied from node_modules on every
  install and every build instead.
*/
const { copyFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const from = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const dir = join(__dirname, '..', 'public', 'pdfjs')

try {
  mkdirSync(dir, { recursive: true })
  copyFileSync(from, join(dir, 'pdf.worker.min.mjs'))
  console.log('[sync:pdfjs] worker copied to public/pdfjs')
} catch (err) {
  // A missing worker only breaks the upload page, and failing the whole
  // install or build over it would be worse than the feature being down.
  console.warn('[sync:pdfjs] could not copy the worker:', err.message)
}
