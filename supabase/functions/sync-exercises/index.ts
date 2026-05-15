/**
 * sync-exercises — Supabase Edge Function
 *
 * Fetches all exercises from the ExerciseDB RapidAPI and upserts them
 * into the Supabase exercises table.
 *
 * Deploy:  supabase functions deploy sync-exercises
 * Secret:  supabase secrets set EXERCISEDB_API_KEY=<your-rapidapi-key>
 * Invoke:  POST /functions/v1/sync-exercises  (with service-role JWT)
 *
 * ExerciseDB free tier: 10 req/day.
 * Each request can fetch up to 1326 exercises in one shot (set limit=1326).
 * So a single call is enough to seed the entire database.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXERCISEDB_HOST = 'exercisedb.p.rapidapi.com'
const BATCH_SIZE = 100   // upsert rows at a time to Supabase

interface ExerciseDBItem {
  id: string
  name: string
  bodyPart: string
  equipment: string
  gifUrl: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
}

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = Deno.env.get('EXERCISEDB_API_KEY')
  if (!apiKey) {
    return new Response('EXERCISEDB_API_KEY secret not set', { status: 500 })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const supabaseKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase       = createClient(supabaseUrl, supabaseKey)

  // Fetch all exercises in one request (limit=1326 fetches everything)
  const response = await fetch(
    `https://${EXERCISEDB_HOST}/exercises?limit=1326&offset=0`,
    {
      headers: {
        'X-RapidAPI-Key':  apiKey,
        'X-RapidAPI-Host': EXERCISEDB_HOST,
      },
    }
  )

  if (!response.ok) {
    const body = await response.text()
    return new Response(`ExerciseDB error ${response.status}: ${body}`, { status: 502 })
  }

  const exercises: ExerciseDBItem[] = await response.json()
  const now = new Date().toISOString()

  // Map to our schema
  const rows = exercises.map((e) => ({
    id:                 crypto.randomUUID(),   // will be replaced by ON CONFLICT
    name:               e.name,
    body_part:          e.bodyPart,
    equipment:          e.equipment,
    image_url:          e.gifUrl,
    instructions:       e.instructions.join('\n'),
    target_muscle:      e.target,
    secondary_muscles:  e.secondaryMuscles,
    exercise_db_id:     e.id,
    is_custom:          false,
    created_by:         null,
    updated_at:         now,
  }))

  // Upsert in batches on exercise_db_id
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('exercises')
      .upsert(batch, { onConflict: 'exercise_db_id', ignoreDuplicates: false })
    if (error) {
      console.error('Upsert error', error)
      return new Response(`DB error: ${error.message}`, { status: 500 })
    }
    inserted += batch.length
  }

  return new Response(
    JSON.stringify({ ok: true, total: exercises.length, inserted }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
