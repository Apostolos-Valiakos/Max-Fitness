/**
 * Local dev helper: fetch exercises from ExerciseDB and upsert into Supabase.
 * Works with Node 16+. New API format: no gifUrl, has description/difficulty/category.
 * Usage: node scripts/sync-exercises.mjs
 */

import https from "https";
import http from "http";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXERCISEDB_KEY = "e84f114ff5msheb95998f4d14cd3p10355djsned24844c4ede";
const EXERCISEDB_HOST = "exercisedb.p.rapidapi.com";
const BATCH_SIZE = 100;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      })
      .on("error", reject);
  });
}

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 54321,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => resolve({ status: res.statusCode, body: out }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Fetch all exercises (paginate to handle free-tier limits) ─────────────────

console.log("Fetching exercises from ExerciseDB...");

const exercises = [];
const PAGE_SIZE = 10;
let offset = 0;

while (true) {
  const { status, body } = await get(
    `https://${EXERCISEDB_HOST}/exercises?limit=${PAGE_SIZE}&offset=${offset}`,
    { "x-rapidapi-key": EXERCISEDB_KEY, "x-rapidapi-host": EXERCISEDB_HOST },
  );

  if (status !== 200) {
    console.error(`ExerciseDB error ${status}: ${body}`);
    process.exit(1);
  }

  const page = JSON.parse(body);
  if (!page.length) break;

  exercises.push(...page);
  process.stdout.write(`\rFetched ${exercises.length} exercises...`);

  if (page.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}

// Deduplicate by exercise_db_id (API occasionally returns duplicates across pages)
const seen = new Set();
const unique = exercises.filter((e) => {
  if (seen.has(e.id)) return false;
  seen.add(e.id);
  return true;
});
console.log(
  `\nFetched ${exercises.length} total (${unique.length} unique). Upserting to Supabase...`,
);
const deduplicated = unique;

const now = new Date().toISOString();

// New API: no gifUrl. description is a summary, instructions is a step array.
// We store description as the first line of instructions so it shows in the UI.
const rows = deduplicated.map((e) => ({
  name: e.name,
  body_part: e.bodyPart,
  equipment: e.equipment,
  image_url: e.gifUrl ?? null,
  instructions: [e.description, ...e.instructions].filter(Boolean).join("\n"),
  target_muscle: e.target,
  secondary_muscles: e.secondaryMuscles,
  exercise_db_id: e.id,
  is_custom: false,
  created_by: null,
  updated_at: now,
}));

// ── Sync via psql to handle FK constraints cleanly ────────────────────────────
// Strategy: UPDATE existing rows matched by (name, equipment), INSERT the rest.

import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const tmpFile = join(tmpdir(), "exercises_seed.sql");

const lines = [];
lines.push("BEGIN;");

for (const row of rows) {
  const esc = (v) =>
    v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
  const arrEsc = (arr) =>
    arr == null
      ? "NULL"
      : `ARRAY[${arr.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(",")}]::text[]`;

  lines.push(`
INSERT INTO public.exercises
  (name, body_part, equipment, image_url, instructions, target_muscle, secondary_muscles, exercise_db_id, is_custom, created_by, updated_at)
VALUES
  (${esc(row.name)}, ${esc(row.body_part)}, ${esc(row.equipment)}, ${esc(row.image_url)},
   ${esc(row.instructions)}, ${esc(row.target_muscle)}, ${arrEsc(row.secondary_muscles)},
   ${esc(row.exercise_db_id)}, false, NULL, ${esc(row.updated_at)})
ON CONFLICT (exercise_db_id) DO UPDATE SET
  name = EXCLUDED.name,
  body_part = EXCLUDED.body_part,
  equipment = EXCLUDED.equipment,
  image_url = EXCLUDED.image_url,
  instructions = EXCLUDED.instructions,
  target_muscle = EXCLUDED.target_muscle,
  secondary_muscles = EXCLUDED.secondary_muscles,
  updated_at = EXCLUDED.updated_at;`);

  // Also update any existing placeholder row with matching name+equipment
  lines.push(`
UPDATE public.exercises SET
  exercise_db_id = ${esc(row.exercise_db_id)},
  image_url = ${esc(row.image_url)},
  instructions = ${esc(row.instructions)},
  target_muscle = ${esc(row.target_muscle)},
  secondary_muscles = ${arrEsc(row.secondary_muscles)},
  updated_at = ${esc(row.updated_at)}
WHERE exercise_db_id IS NULL
  AND is_custom = false
  AND lower(name) = lower(${esc(row.name)})
  AND lower(equipment) = lower(${esc(row.equipment)});`);
}

lines.push("COMMIT;");

writeFileSync(tmpFile, lines.join("\n"));

console.log(`Running psql sync for ${rows.length} exercises...`);
try {
  execSync(`psql "${DB_URL}" -f "${tmpFile}" -q`, { stdio: "pipe" });
} catch (e) {
  console.error("psql error:", e.stderr?.toString());
  process.exit(1);
} finally {
  unlinkSync(tmpFile);
}

// Verify count
const count = execSync(
  `psql "${DB_URL}" -t -c "SELECT COUNT(*) FROM public.exercises WHERE is_custom = false;"`,
)
  .toString()
  .trim();
console.log(`Done! ${count} global exercises now in DB.`);
