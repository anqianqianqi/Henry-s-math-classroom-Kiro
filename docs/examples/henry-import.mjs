#!/usr/bin/env node
/**
 * Send .henryproblem files to the classroom's problem bank.
 *
 * A complete client for POST /api/studio/import with no dependencies, usable
 * as a command line or imported into another app. The contract it speaks is
 * documented in docs/STUDIO_IMPORT_API.md.
 *
 * Command line:
 *   STUDIO_IMPORT_KEY=… node henry-import.mjs "Algebra/Exponent 11.henryproblem" [more files]
 *
 * Options, as environment variables:
 *   STUDIO_IMPORT_KEY   the import key, or a teacher's access token
 *   STUDIO_SITE         the site, default https://henrymathclassroom.com
 *
 * Each file is sent on its own, in order, and the reply's id is printed next
 * to the file name. Keep those ids: sending a file again with its id updates
 * the row instead of adding a twin.
 */
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const DEFAULT_SITE = 'https://henrymathclassroom.com'

/**
 * Send one snapshot. Resolves with the route's reply ({ id, created, ... }),
 * or rejects with an Error whose message is the route's own sentence.
 *
 * @param {object} options
 * @param {string} options.token          import key or teacher access token
 * @param {string} options.snapshotText   the .henryproblem file contents
 * @param {string} [options.site]         defaults to the production site
 * @param {string} [options.bankId]       update this row instead of inserting
 * @param {string} [options.revision]     your content hash, stored on the row
 * @param {{ base64: string, contentType?: string }} [options.image]  the cropped diagram
 */
export async function importHenryProblem({ token, snapshotText, site = DEFAULT_SITE, bankId, revision, image }) {
  if (!token) throw new Error('An import key or access token is required.')
  const body = { snapshot: snapshotText }
  if (bankId) body.bankId = bankId
  if (revision) body.revision = revision
  if (image) body.image = image

  const response = await fetch(`${site.replace(/\/$/, '')}/api/studio/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(reply.error || `The site answered with HTTP ${response.status}.`)
  return reply
}

/** Rows already on the site, optionally only those from one snapshot name. */
export async function listImported({ token, site = DEFAULT_SITE, basename: name } = {}) {
  const query = name ? `?basename=${encodeURIComponent(name)}` : ''
  const response = await fetch(`${site.replace(/\/$/, '')}/api/studio/import${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const reply = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(reply.error || `The site answered with HTTP ${response.status}.`)
  return reply.items || []
}

// ── Command line ─────────────────────────────────────────────────────────

const runningAsScript = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))

if (runningAsScript) {
  const files = process.argv.slice(2)
  const token = process.env.STUDIO_IMPORT_KEY
  const site = process.env.STUDIO_SITE || DEFAULT_SITE
  if (!files.length || !token) {
    console.error('Usage: STUDIO_IMPORT_KEY=<key> node henry-import.mjs <file.henryproblem> [more files]')
    process.exit(2)
  }
  let failed = 0
  for (const file of files) {
    try {
      const snapshotText = await readFile(file, 'utf8')
      const result = await importHenryProblem({ token, snapshotText, site })
      console.log(`${result.created ? 'added  ' : 'updated'}  ${basename(file)}  ->  ${result.id}`)
      if (result.skippedTags?.length) console.log(`         tags not created: ${result.skippedTags.join(', ')}`)
    } catch (error) {
      failed += 1
      console.error(`failed   ${basename(file)}  ->  ${error.message}`)
    }
  }
  process.exit(failed ? 1 : 0)
}
