/**
 * sync-exercises.mjs — Exercise seeder using ExerciseDB (RapidAPI)
 *
 * Source: exercisedb.p.rapidapi.com  (~1,300+ exercises with GIFs)
 * API key is read from EXERCISEDB_API_KEY in mobile-app/.env.local
 *
 * Usage:  node scripts/sync-exercises.mjs
 *
 * Behaviour:
 *   • Fetches all exercises from ExerciseDB (batched)
 *   • UPSERTs by exercise_db_id — safe to re-run at any time
 *   • Fills missing image_url; updates names, muscle data, instructions
 *   • Never touches exercises where is_custom = true
 */

import https        from 'https'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs'
import { tmpdir }   from 'os'
import { join }     from 'path'

const DB_URL     = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const API_HOST   = 'exercisedb.p.rapidapi.com'
const BATCH_SIZE = 1300
const SQL_CHUNK  = 200   // rows per INSERT statement

// ── Load API key ──────────────────────────────────────────────────────────────

function loadApiKey() {
  if (process.env.EXERCISEDB_API_KEY) return process.env.EXERCISEDB_API_KEY
  const envPath = new URL('../mobile-app/.env.local', import.meta.url).pathname
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, 'utf8')
      .split('\n').find(l => l.startsWith('EXERCISEDB_API_KEY='))
    if (line) return line.split('=')[1].trim()
  }
  throw new Error('EXERCISEDB_API_KEY not found. Set it in mobile-app/.env.local')
}

// ── Equipment mapping ─────────────────────────────────────────────────────────

const EQUIP = {
  'assisted': 'other', 'band': 'band', 'barbell': 'barbell',
  'body weight': 'bodyweight', 'bosu ball': 'other', 'cable': 'cable',
  'dumbbell': 'dumbbell', 'elliptical machine': 'machine', 'ez barbell': 'barbell',
  'hammer': 'dumbbell', 'kettlebell': 'kettlebell', 'leverage machine': 'machine',
  'medicine ball': 'other', 'olympic barbell': 'barbell', 'resistance band': 'band',
  'roller': 'other', 'rope': 'cable', 'skierg machine': 'machine',
  'sled machine': 'machine', 'smith machine': 'machine', 'stability ball': 'other',
  'stationary bike': 'machine', 'stepmill machine': 'machine', 'tire': 'other',
  'trap bar': 'barbell', 'upper body ergometer': 'machine', 'weighted': 'other',
  'wheel roller': 'other',
}
const mapEquip = raw => EQUIP[raw?.toLowerCase()] ?? 'other'
const cap = s  => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

// ── HTTP fetch ────────────────────────────────────────────────────────────────

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let body = ''
      res.on('data', d => (body += d))
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error(`JSON parse error: ${body.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchAll(apiKey) {
  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': API_HOST }
  let all = [], offset = 0
  console.log('Fetching from ExerciseDB…')
  while (true) {
    const url = `https://${API_HOST}/exercises?limit=${BATCH_SIZE}&offset=${offset}`
    const batch = await fetchJson(url, headers)
    if (!Array.isArray(batch) || !batch.length) break
    all = all.concat(batch)
    process.stdout.write(`\r  ${all.length} exercises fetched…`)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }
  console.log(`\nTotal: ${all.length}`)
  return all
}

// ── SQL helpers ───────────────────────────────────────────────────────────────

const esc = v =>
  v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`

const escArr = arr => {
  if (!arr?.length) return 'NULL'
  const items = arr.map(s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
  return `'{${items.join(',')}}'`
}

function buildSql(batch, now) {
  const vals = batch.map(ex => {
    const dbId  = `edb-${ex.id}`
    const instr = ex.instructions?.length ? ex.instructions.join('\n') : null
    return (
      `(gen_random_uuid(), ${esc(cap(ex.name))}, ${esc(ex.bodyPart)}, ` +
      `${esc(mapEquip(ex.equipment))}, ${esc(ex.gifUrl)}, ${esc(instr)}, ` +
      `false, NULL, ${esc(ex.target)}, ${escArr(ex.secondaryMuscles)}, ` +
      `${esc(dbId)}, NULL, ${esc(now)}, ${esc(now)})`
    )
  }).join(',\n  ')

  return `
INSERT INTO public.exercises
  (id, name, body_part, equipment, image_url, instructions, is_custom, created_by,
   target_muscle, secondary_muscles, exercise_db_id, sticky_note, created_at, updated_at)
VALUES
  ${vals}
ON CONFLICT (exercise_db_id) DO UPDATE SET
  name              = EXCLUDED.name,
  body_part         = EXCLUDED.body_part,
  equipment         = EXCLUDED.equipment,
  image_url         = COALESCE(exercises.image_url, EXCLUDED.image_url),
  instructions      = COALESCE(exercises.instructions, EXCLUDED.instructions),
  target_muscle     = EXCLUDED.target_muscle,
  secondary_muscles = EXCLUDED.secondary_muscles,
  updated_at        = EXCLUDED.updated_at
WHERE exercises.is_custom = false;
`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey    = loadApiKey()
  const exercises = await fetchAll(apiKey)

  if (!exercises.length) {
    console.error('No exercises returned. Check your API key.')
    process.exit(1)
  }

  const now = new Date().toISOString()
  let done  = 0

  for (let i = 0; i < exercises.length; i += SQL_CHUNK) {
    const batch = exercises.slice(i, i + SQL_CHUNK)
    const sql   = buildSql(batch, now)
    const tmp   = join(tmpdir(), `ex_sync_${i}.sql`)
    writeFileSync(tmp, sql)
    try {
      execSync(`psql "${DB_URL}" -f "${tmp}" -q`, { stdio: 'pipe' })
      done += batch.length
      process.stdout.write(`\r  upserted ${done}/${exercises.length}`)
    } finally {
      unlinkSync(tmp)
    }
  }

  console.log('\n')

  const count = execSync(
    `psql "${DB_URL}" -t -c "SELECT COUNT(*) FROM exercises WHERE is_custom = false;"`,
    { encoding: 'utf8' }
  ).trim()
  console.log(`Done. DB now has ${count} non-custom exercises.`)
}

main().catch(e => { console.error('\n' + e.message); process.exit(1) })
