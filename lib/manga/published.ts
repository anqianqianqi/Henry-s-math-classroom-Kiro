import { PublishedManga } from './contract'

/** Reads only the publication contract; no workflow draft data is visible here. */
export async function getPublishedMangaForChallenge(supabase: any, challengeId: string): Promise<PublishedManga | null> {
  const { data, error } = await supabase
    .from('manga_published_comics')
    .select('id,source_challenge_id,class_id,title,language,math_takeaway,cover_image_url,panel_count,published_at,manga_comic_panels(panel_index,image_url,dialogue,narration,math_visual)')
    .eq('source_challenge_id', challengeId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  data.manga_comic_panels = [...(data.manga_comic_panels || [])].sort((a: any, b: any) => a.panel_index - b.panel_index)
  return data as PublishedManga
}

