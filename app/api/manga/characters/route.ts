import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaTeacher } from '@/lib/manga/server'
import { characterBibleSchema } from '@/lib/manga/character'

import { z } from 'zod'

const saveSchema=z.object({status:z.enum(['draft','approved']).default('draft'),bible:characterBibleSchema})

export async function POST(request:NextRequest){
  try{
    await requireMangaTeacher();const input=saveSchema.parse(await request.json());const db=mangaServiceDb()
    const {data:character,error}=await db.from('manga_characters').insert({name:input.bible.name,status:input.status,current_version:1}).select('id').single();if(error)throw error
    const {error:versionError}=await db.from('manga_character_versions').insert({character_id:character.id,version:1,bible:input.bible});if(versionError)throw versionError
    return NextResponse.json({id:character.id,version:1},{status:201})
  }catch(error){const status=error instanceof Error&&error.message==='UNAUTHORIZED'?401:400;return NextResponse.json({error:error instanceof Error?error.message:'Could not save character'},{status})}
}

export async function GET(request:NextRequest){
  try{await requireMangaTeacher();const {data,error}=await mangaServiceDb().from('manga_characters').select('id,name,status,current_version,thumbnail_url,updated_at').neq('status','archived').order('updated_at',{ascending:false});if(error)throw error;return NextResponse.json(data)}
  catch(error){const status=error instanceof Error&&error.message==='UNAUTHORIZED'?401:400;return NextResponse.json({error:error instanceof Error?error.message:'Could not list characters'},{status})}
}
