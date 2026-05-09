import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.500.0'

Deno.serve(async (req) => {
  try {
    // Verify the request has authorization (service role or valid token)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch all challenges with their assignments and submission counts
    const { data: challenges, error } = await supabase
      .from('daily_challenges')
      .select(`
        *,
        challenge_assignments(class_id),
        challenge_submissions(id, user_id, content, points, is_locked, submitted_at)
      `)
      .order('challenge_date', { ascending: false })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      total_challenges: challenges?.length || 0,
      challenges
    }

    const jsonBody = JSON.stringify(exportData, null, 2)

    // Upload to S3
    const s3 = new S3Client({
      region: Deno.env.get('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const key = `exports/daily_challenges_${timestamp}.json`

    await s3.send(new PutObjectCommand({
      Bucket: Deno.env.get('S3_BUCKET')!,
      Key: key,
      Body: jsonBody,
      ContentType: 'application/json',
    }))

    return new Response(
      JSON.stringify({
        success: true,
        count: challenges?.length || 0,
        s3_key: key,
        exported_at: exportData.exported_at
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
