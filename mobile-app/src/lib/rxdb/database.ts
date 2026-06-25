import { createRxDatabase, addRxPlugin } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { RxDBQueryBuilderPlugin } from "rxdb/plugins/query-builder";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  exerciseSchema,
  workoutSessionSchema,
  workoutTemplateSchema,
  setSchema,
  templateExerciseSchema,
} from "./schemas";

async function hashFunction(data: string | ArrayBuffer | Blob): Promise<string> {
  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Blob) {
    bytes = new Uint8Array(await data.arrayBuffer());
  } else {
    bytes = new Uint8Array(data);
  }
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(buf)).map((b: number) => b.toString(16).padStart(2, "0")).join("");
  }
  const hash = sha256(bytes);
  return Array.from(hash).map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

if (import.meta.env.DEV) addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

let db: Awaited<ReturnType<typeof buildDatabase>> | null = null;

async function buildDatabase() {
  // DevMode requires a schema-validating storage wrapper; production uses plain Dexie.
  const storage = import.meta.env.DEV
    ? wrappedValidateAjvStorage({ storage: getRxStorageDexie() })
    : getRxStorageDexie();

  const rxdb = await createRxDatabase({
    name: "maxfitnes_v1",
    storage,
    multiInstance: false,
    ignoreDuplicate: true,
    hashFunction,
  });

  const noopMigration = { 1: (doc: any) => doc }

  await rxdb.addCollections({
    exercises: {
      schema: exerciseSchema,
      migrationStrategies: {
        1: (doc: any) => doc,
        2: (doc: any) => ({ ...doc, target_muscle: null, secondary_muscles: null, exercise_db_id: null }),
        3: (doc: any) => ({ ...doc, sticky_note: null }),
        4: (doc: any) => ({ ...doc, gym_id: null }),
      },
    },
    workout_sessions: {
      schema: workoutSessionSchema,
      migrationStrategies: {
        1: (doc: any) => doc,
        2: (doc: any) => ({ ...doc, is_completed: doc.is_completed ?? false }),
      },
    },
    workout_templates:  {
      schema: workoutTemplateSchema,
      migrationStrategies: {
        1: (doc: any) => doc,
        2: (doc: any) => ({ ...doc, visibility: doc.visibility ?? 'private' }),
        3: (doc: any) => ({ ...doc, folder_name: null }),
      },
    },
    sets:               { schema: setSchema,              migrationStrategies: noopMigration },
    template_exercises: {
      schema: templateExerciseSchema,
      migrationStrategies: {
        1: (doc: any) => ({ ...doc, superset_group: null, rest_seconds: null }),
        2: (doc: any) => ({ ...doc, set_configs: null }),
      },
    },
  });

  return rxdb;
}

export async function initDatabase() {
  if (!db) db = await buildDatabase();
  return db;
}

export function getDatabase() {
  if (!db)
    throw new Error("Database not initialized — call initDatabase() first");
  return db;
}

export type AppDatabase = Awaited<ReturnType<typeof buildDatabase>>;
