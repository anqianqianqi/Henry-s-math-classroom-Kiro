import 'server-only'
import { MangaProjectRequest } from './contract'

export async function createMangaWorkflowProject(payload: MangaProjectRequest) {
  const baseUrl = process.env.MANGA_WORKFLOW_URL?.replace(/\/$/, '')
  const token = process.env.MANGA_WORKFLOW_ADMIN_TOKEN
  if (!baseUrl || !token) throw new Error('Manga workflow is not configured')

  const response = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || `Manga workflow returned ${response.status}`)
  return body as { id: string; state: unknown }
}

