import { replicateRxCollection } from 'rxdb/plugins/replication'
import { supabase }              from '@/lib/supabase'
import { getDatabase }           from './database'

type Checkpoint = { updated_at: string; id: string }
const BATCH_SIZE = 100
let replications: Array<{ cancel(): void }> = []

// ─── Generic helpers ──────────────────────────────────────────────────────────

function toRxDoc(row: any) {
  const { deleted, ...rest } = row
  return { ...rest, _deleted: deleted ?? false }
}

function toSupabaseDoc(doc: any) {
  const { _deleted, _rev, _meta, _attachments, ...rest } = doc
  return { ...rest, deleted: _deleted ?? false }
}

function buildPullHandler(table: string, columns = '*', extraFilter?: (cp: Checkpoint | null) => Record<string, any>) {
  return {
    batchSize: BATCH_SIZE,
    async handler(checkpoint: Checkpoint | null | undefined, batchSize: number) {
      const cp = checkpoint ?? null
      let query = supabase.from(table).select(columns)

      if (cp) {
        query = query.or(`updated_at.gt.${cp.updated_at},and(updated_at.eq.${cp.updated_at},id.gt.${cp.id})`)
      }

      if (extraFilter) {
        const filters = extraFilter(cp)
        for (const [col, val] of Object.entries(filters)) query = (query as any).eq(col, val)
      }

      const { data, error } = await query
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(batchSize)

      if (error) throw error

      const documents = (data ?? []).map(toRxDoc)
      const last      = (data as any[])?.at(-1)

      return {
        documents,
        checkpoint: last ? { updated_at: last.updated_at as string, id: last.id as string } : cp,
      }
    },
  }
}

function buildPushHandler(table: string) {
  return {
    batchSize: BATCH_SIZE,
    async handler(rows: any[]) {
      const docs = rows.map(r => toSupabaseDoc(r.newDocumentState))
      const { error } = await supabase.from(table).upsert(docs, { onConflict: 'id' })
      if (error) return rows // return conflicts so RxDB retries
      return []
    },
  }
}

// ─── Per-collection replication ───────────────────────────────────────────────

async function replicateExercises(db: Awaited<ReturnType<typeof getDatabase>>) {
  return replicateRxCollection({
    collection:      db.exercises,
    replicationIdentifier: 'exercises-supabase-v3',
    deletedField:    '_deleted',
    pull:            buildPullHandler('exercises', 'id,name,body_part,equipment,image_url,instructions,is_custom,created_by,updated_at,target_muscle,secondary_muscles,exercise_db_id,sticky_note'),
    // exercises are read-only from server — no push
    live:            true,
    retryTime:       5000,
  })
}

async function replicateSessions(db: Awaited<ReturnType<typeof getDatabase>>, userId: string) {
  return replicateRxCollection({
    collection:      db.workout_sessions,
    replicationIdentifier: 'workout-sessions-supabase-v2',
    deletedField:    '_deleted',
    pull:            buildPullHandler('workout_sessions', 'id,user_id,template_id,name,started_at,finished_at,updated_at,notes,is_completed,deleted', () => ({ user_id: userId })),
    push:            buildPushHandler('workout_sessions'),
    live:            true,
    retryTime:       5000,
  })
}

async function replicateSets(db: Awaited<ReturnType<typeof getDatabase>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Pull sets via join through sessions
  return replicateRxCollection({
    collection:      db.sets,
    replicationIdentifier: 'sets-supabase',
    deletedField:    '_deleted',
    pull: {
      batchSize: BATCH_SIZE,
      async handler(checkpoint: Checkpoint | null | undefined, batchSize: number) {
        const cp  = checkpoint ?? null
        const from = new Date()
        from.setDate(from.getDate() - 30)

        let query = supabase.from('sets').select('id,session_id,exercise_id,set_number,set_type,weight_kg,reps,rpe,duration_secs,distance_m,notes,logged_at,updated_at,deleted')
        if (cp) {
          query = query.or(`updated_at.gt.${cp.updated_at},and(updated_at.eq.${cp.updated_at},id.gt.${cp.id})`)
        } else {
          query = query.gte('updated_at', from.toISOString())
        }

        const { data, error } = await query
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(batchSize)

        if (error) throw error
        const documents = (data ?? []).map(toRxDoc)
        const last      = (data as any[])?.at(-1)
        return { documents, checkpoint: last ? { updated_at: last.updated_at as string, id: last.id as string } : cp }
      },
    },
    push: buildPushHandler('sets'),
    live: true,
    retryTime: 5000,
  })
}

async function replicateTemplates(db: Awaited<ReturnType<typeof getDatabase>>) {
  return replicateRxCollection({
    collection:      db.workout_templates,
    replicationIdentifier: 'workout-templates-supabase-v3',
    deletedField:    '_deleted',
    // No owner_id filter — RLS returns own templates + public ones per user tier
    pull:            buildPullHandler('workout_templates', 'id,owner_id,assigned_by,name,notes,is_public,visibility,updated_at,folder_name'),
    push:            buildPushHandler('workout_templates'),
    live:            true,
    retryTime:       5000,
  })
}

async function replicateTemplateExercises(db: Awaited<ReturnType<typeof getDatabase>>) {
  return replicateRxCollection({
    collection:      db.template_exercises,
    replicationIdentifier: 'template-exercises-supabase-v2',
    deletedField:    '_deleted',
    // RLS automatically filters to templates the user owns — no extra filter needed
    pull:            buildPullHandler('template_exercises', 'id,template_id,exercise_id,position,target_sets,target_reps,target_rpe,notes,superset_group,rest_seconds,set_configs,updated_at,deleted'),
    push:            buildPushHandler('template_exercises'),
    live:            true,
    retryTime:       5000,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startReplication() {
  const db = getDatabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Cancel any existing
  await stopReplication()

  const reps = await Promise.all([
    replicateExercises(db),
    replicateSessions(db, user.id),
    replicateSets(db),
    replicateTemplates(db),
    replicateTemplateExercises(db),
  ])

  replications = reps
}

export async function stopReplication() {
  for (const rep of replications) { try { rep.cancel() } catch {} }
  replications = []
}

/** Load sets older than `beforeDate` on demand */
export async function loadOlderSessions(beforeDate: string): Promise<boolean> {
  const db   = getDatabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id,user_id,template_id,name,started_at,finished_at,updated_at,notes,deleted')
    .eq('user_id', user.id)
    .lt('started_at', beforeDate)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20)

  if (error || !data?.length) return false

  for (const row of data) {
    const existing = await db.workout_sessions.findOne(row.id).exec()
    if (!existing) await db.workout_sessions.insert(toRxDoc(row)).catch(() => {})
  }

  // Also fetch their sets
  const sessionIds = data.map(r => r.id)
  const { data: sets } = await supabase.from('sets').select('id,session_id,exercise_id,set_number,set_type,weight_kg,reps,rpe,duration_secs,distance_m,notes,logged_at,updated_at,deleted').in('session_id', sessionIds)
  if (sets) {
    for (const row of sets) {
      const existing = await db.sets.findOne(row.id).exec()
      if (!existing) await db.sets.insert(toRxDoc(row)).catch(() => {})
    }
  }

  return data.length === 20
}
