import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaTeacher } from '@/lib/manga/server'
import { characterInterviewJsonSchema, characterInterviewRequestSchema, characterInterviewResponseSchema } from '@/lib/manga/character'
import { structuredResponse } from '@/lib/manga/openai'

export async function POST(request: NextRequest) {
  try {
    await requireMangaTeacher()
    const input = characterInterviewRequestSchema.parse(await request.json())
    const result = await structuredResponse({
      instructions:'You design consistent, child-safe characters for an educational math comic. Ask at most three high-value questions and give 2-4 recommendations for each. Preserve confirmed choices. A ready character needs a unique story role, reproducible personality and voice, distinct silhouette, exact palette, at least three immutable anchors, forbidden elements, and model-neutral generation prompts. Never imitate a living artist.',
      prompt:JSON.stringify(input), name:'character_interview', schema:characterInterviewJsonSchema, validate:characterInterviewResponseSchema,
    })
    return NextResponse.json(result)
  } catch (error) {
    const status=error instanceof Error && error.message==='UNAUTHORIZED' ? 401 : 400
    return NextResponse.json({error:error instanceof Error ? error.message : 'Character interview failed'},{status})
  }
}
