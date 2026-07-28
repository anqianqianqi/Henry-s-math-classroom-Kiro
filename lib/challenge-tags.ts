/**
 * Tag resolution shared by the .henryproblem import flows.
 *
 * Snapshots carry tag *names* ("Number Theory"), while challenges store tag
 * *ids*. These helpers turn one into the other and report which names have no
 * tag yet, so the teacher can confirm before anything is created.
 */

/** An existing tag with every localized name it is known by. */
export interface KnownTag {
  id: string
  /** All names across languages, used for matching. */
  names: string[]
}

export interface ResolvedTags {
  /** Ids of tags that already exist. */
  matchedIds: string[]
  /** Names with no matching tag — these would need creating. */
  newNames: string[]
}

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Split incoming tag names into existing ids and names that do not exist yet.
 * Matching is case-insensitive and checks every language a tag is named in.
 * Duplicates are collapsed.
 */
export function resolveTagNames(names: string[], knownTags: KnownTag[]): ResolvedTags {
  const lookup = new Map<string, string>()
  for (const tag of knownTags) {
    for (const name of tag.names) {
      const key = normalize(name)
      if (key && !lookup.has(key)) lookup.set(key, tag.id)
    }
  }

  const matchedIds: string[] = []
  const newNames: string[] = []
  const seenIds = new Set<string>()
  const seenNew = new Set<string>()

  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const id = lookup.get(normalize(name))
    if (id) {
      if (!seenIds.has(id)) {
        seenIds.add(id)
        matchedIds.push(id)
      }
    } else if (!seenNew.has(normalize(name))) {
      seenNew.add(normalize(name))
      newNames.push(name)
    }
  }

  return { matchedIds, newNames }
}

/** Slug used as challenge_tags.name, matching the single-upload flow. */
export function tagSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * Create the given tag names and return a name -> id map for the ones that
 * succeeded. Failures are skipped rather than aborting the whole batch.
 */
export async function createChallengeTags(
  supabase: any,
  names: string[],
  userId: string
): Promise<Map<string, string>> {
  const created = new Map<string, string>()

  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed) continue
    try {
      const { data: newTag } = await supabase
        .from('challenge_tags')
        .insert({ name: tagSlug(trimmed), created_by: userId })
        .select('id')
        .single()

      if (newTag?.id) {
        await supabase
          .from('challenge_tag_names')
          .insert({ tag_id: newTag.id, language: 'en', name: trimmed })
        created.set(normalize(trimmed), newTag.id)
      }
    } catch {
      // Leave it out; the caller reports what was skipped.
    }
  }

  return created
}

/**
 * Sort like a person reads a folder listing: "Angle 9" before "Angle 10".
 * The Prettify batch tools produce numbered runs, so plain lexical order
 * would scramble them.
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
