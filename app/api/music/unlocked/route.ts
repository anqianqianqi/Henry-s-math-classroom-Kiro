import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ tracks: [] })

  const { data, error } = await supabase
    .from('user_unlocked_tracks')
    .select(`
      item_id,
      shop_items (
        id,
        title,
        music_file
      )
    `)
    .eq('user_id', user.id)

  if (error || !data) return NextResponse.json({ tracks: [] })

  const tracks = data
    .filter((row: any) => row.shop_items?.music_file)
    .map((row: any) => ({
      file:  row.shop_items.music_file as string,
      title: row.shop_items.title as string,
    }))

  return NextResponse.json({ tracks })
}
