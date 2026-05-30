/**
 * sync-exercises.mjs — One-shot exercise seeder
 *
 * Source: yuhonas/free-exercise-db (GitHub, no API key needed)
 *   https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
 *   ~873 exercises, static JPG images hosted on GitHub CDN.
 *
 * Usage:  node scripts/sync-exercises.mjs
 *
 * Prerequisites: psql must be installed.
 * DB: Supabase CLI local dev at 127.0.0.1:54322.
 */

import https        from 'https'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir }   from 'os'
import { join }     from 'path'

const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const DB_URL   = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// ── Mappings to our DB enums ──────────────────────────────────────────────────

// body_part enum: chest | back | shoulders | biceps | triceps | forearms |
//                 quads | hamstrings | glutes | calves | core | full_body
const MUSCLE_TO_BODY_PART = {
  abdominals:        'core',
  obliques:          'core',
  abductors:         'quads',
  adductors:         'quads',
  'hip flexors':     'quads',
  'it band':         'quads',
  quadriceps:        'quads',
  hamstrings:        'hamstrings',
  glutes:            'glutes',
  piriformis:        'glutes',
  calves:            'calves',
  soleus:            'calves',
  'tibialis anterior': 'calves',
  chest:             'chest',
  lats:              'back',
  'lower back':      'back',
  'middle back':     'back',
  rhomboids:         'back',
  traps:             'back',
  shoulders:         'shoulders',
  biceps:            'biceps',
  brachialis:        'biceps',
  triceps:           'triceps',
  forearms:          'forearms',
  brachioradialis:   'forearms',
  neck:              'full_body',
}

function mapBodyPart(primaryMuscles) {
  for (const m of (primaryMuscles ?? [])) {
    const mapped = MUSCLE_TO_BODY_PART[m.toLowerCase()]
    if (mapped) return mapped
  }
  console.warn(`  Unknown primaryMuscles ${JSON.stringify(primaryMuscles)} → full_body`)
  return 'full_body'
}

// equipment enum: barbell | dumbbell | cable | machine | bodyweight |
//                 kettlebell | band | other
const EQUIP_MAP = {
  'body only':     'bodyweight',
  'barbell':       'barbell',
  'e-z curl bar':  'barbell',
  'dumbbell':      'dumbbell',
  'cable':         'cable',
  'kettlebells':   'kettlebell',
  'bands':         'band',
  'machine':       'machine',
  'medicine ball': 'other',
  'exercise ball': 'other',
  'foam roll':     'other',
  'other':         'other',
}

function mapEquipment(equipment) {
  return EQUIP_MAP[(equipment ?? '').toLowerCase()] ?? 'other'
}

// ── HTTPS fetch helper ────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`))
        } else {
          resolve(JSON.parse(data))
        }
      })
    }).on('error', reject)
  })
}

// ── SQL helpers ───────────────────────────────────────────────────────────────
const esc     = v => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
const escJson = v => v == null ? 'NULL' : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('Fetching exercises from free-exercise-db (GitHub)...')
const raw = await fetchJSON(DATA_URL)
console.log(`Received ${raw.length} exercises. Mapping to schema...`)

const rows = raw.map(e => {
  const bodyPart    = mapBodyPart(e.primaryMuscles)
  const equipment   = mapEquipment(e.equipment)
  const imageUrl    = e.images?.[0] ? `${IMG_BASE}/${e.id}/${e.images[0].split('/').pop()}` : null
  const instructions = Array.isArray(e.instructions) ? e.instructions.join('\n') : null
  const targetMuscle = e.primaryMuscles?.[0] ?? null

  return {
    name:              e.name,
    body_part:         bodyPart,
    equipment:         equipment,
    image_url:         imageUrl,
    instructions:      instructions,
    target_muscle:     targetMuscle,
    secondary_muscles: e.secondaryMuscles?.length ? e.secondaryMuscles : null,
    exercise_db_id:    `gh_${e.id}`,  // prefix to avoid clashing with old RapidAPI IDs
  }
})

console.log(`Building SQL for ${rows.length} exercises...`)

const now   = new Date().toISOString()
const lines = ['BEGIN;']

for (const row of rows) {
  // Phase 1: attach exercise_db_id to any existing row matched by name+equipment
  // (preserves the existing UUID so workout history stays intact)
  lines.push(`
UPDATE public.exercises SET
  exercise_db_id    = ${esc(row.exercise_db_id)},
  image_url         = ${esc(row.image_url)},
  instructions      = COALESCE(${esc(row.instructions)}, instructions),
  target_muscle     = ${esc(row.target_muscle)},
  secondary_muscles = ${escJson(row.secondary_muscles)},
  updated_at        = ${esc(now)}
WHERE exercise_db_id IS NULL
  AND is_custom = false
  AND created_by IS NULL
  AND lower(name)      = lower(${esc(row.name)})
  AND lower(equipment) = lower(${esc(row.equipment)});`)

  // Phase 2: insert only if no row with this name+equipment exists yet
  lines.push(`
INSERT INTO public.exercises
  (name, body_part, equipment, image_url, instructions,
   target_muscle, secondary_muscles, exercise_db_id,
   is_custom, created_by, updated_at)
SELECT
  ${esc(row.name)}, ${esc(row.body_part)}, ${esc(row.equipment)},
  ${esc(row.image_url)}, ${esc(row.instructions)},
  ${esc(row.target_muscle)}, ${escJson(row.secondary_muscles)}, ${esc(row.exercise_db_id)},
  false, NULL, ${esc(now)}
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises
  WHERE lower(name) = lower(${esc(row.name)})
    AND lower(equipment) = lower(${esc(row.equipment)})
    AND created_by IS NULL
    AND is_custom = false
)
ON CONFLICT (exercise_db_id) DO UPDATE SET
  image_url         = EXCLUDED.image_url,
  instructions      = EXCLUDED.instructions,
  target_muscle     = EXCLUDED.target_muscle,
  secondary_muscles = EXCLUDED.secondary_muscles,
  updated_at        = EXCLUDED.updated_at;`)
}

lines.push('COMMIT;')

const tmpFile = join(tmpdir(), 'exercises_seed.sql')
writeFileSync(tmpFile, lines.join('\n'))

console.log('Running psql upsert...')
try {
  execSync(`psql "${DB_URL}" -f "${tmpFile}" -q`, {
    stdio: 'pipe',
    env: { ...process.env, PGPASSWORD: 'postgres' },
  })
} catch (e) {
  console.error('psql error:\n', e.stderr?.toString() ?? e.message)
  process.exit(1)
} finally {
  unlinkSync(tmpFile)
}

const count = execSync(
  `psql "${DB_URL}" -t -c "SELECT COUNT(*) FROM public.exercises WHERE is_custom = false;"`,
  { env: { ...process.env, PGPASSWORD: 'postgres' } }
).toString().trim()

console.log(`\nDone! ${count.trim()} global exercises now in the database.`)
console.log('Images load from GitHub CDN — online required to display them.')
