import type { RxJsonSchema } from "rxdb";

export interface TemplateExerciseDocument {
  id: string
  template_id: string
  exercise_id: string
  position: number
  target_sets: number | null
  target_reps: number | null
  target_rpe: number | null
  notes: string | null
  superset_group: number | null
  rest_seconds: number | null
  updated_at: string
}

export interface ExerciseDocument {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  image_url: string | null;
  instructions: string | null;
  is_custom: boolean;
  created_by: string | null;
  updated_at: string;
  target_muscle: string | null;
  secondary_muscles: string[] | null;
  exercise_db_id: string | null;
  sticky_note: string | null;
}

export interface WorkoutSessionDocument {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  notes?: string | null;
  is_completed?: boolean;
}

export interface WorkoutTemplateDocument {
  id: string;
  owner_id: string;
  assigned_by: string | null;
  name: string;
  notes: string | null;
  is_public: boolean;
  visibility: string;
  updated_at: string;
  folder_name: string | null;
}

export interface SetDocument {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  set_type: "warmup" | "working" | "failure" | "drop" | "myorep";
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_secs: number | null;
  distance_m: number | null;
  notes: string | null;
  logged_at: string;
  updated_at: string;
}

export const templateExerciseSchema: RxJsonSchema<TemplateExerciseDocument> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:              { type: 'string', maxLength: 36 },
    template_id:     { type: 'string', maxLength: 36 },
    exercise_id:     { type: 'string', maxLength: 36 },
    position:        { type: 'integer' },
    target_sets:     { type: ['integer', 'null'] },
    target_reps:     { type: ['integer', 'null'] },
    target_rpe:      { type: ['number',  'null'] },
    notes:           { type: ['string',  'null'] },
    superset_group:  { type: ['integer', 'null'] },
    rest_seconds:    { type: ['integer', 'null'] },
    updated_at:      { type: 'string', maxLength: 32 },
  },
  required: ['id', 'template_id', 'exercise_id', 'position', 'updated_at'],
  indexes: ['template_id', 'updated_at'],
}

export const exerciseSchema: RxJsonSchema<ExerciseDocument> = {
  version: 3,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    name: { type: "string", maxLength: 200 },
    body_part: { type: "string", maxLength: 50 },
    equipment: { type: "string", maxLength: 50 },
    image_url: { type: ["string", "null"] },
    instructions: { type: ["string", "null"] },
    is_custom: { type: "boolean" },
    created_by: { type: ["string", "null"], maxLength: 36 },
    updated_at: { type: "string", maxLength: 32 },
    target_muscle: { type: ["string", "null"] },
    secondary_muscles: { type: ["array", "null"], items: { type: "string" } },
    exercise_db_id: { type: ["string", "null"] },
    sticky_note: { type: ["string", "null"] },
  },
  required: ["id", "name", "body_part", "equipment", "updated_at"],
  indexes: ["updated_at", "body_part"],
};

export const workoutSessionSchema: RxJsonSchema<WorkoutSessionDocument> = {
  version: 2,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    user_id: { type: "string", maxLength: 36 },
    template_id: { type: ["string", "null"], maxLength: 36 },
    name: { type: "string", maxLength: 200 },
    started_at: { type: "string", maxLength: 32 },
    finished_at: { type: ["string", "null"], maxLength: 32 },
    updated_at: { type: "string", maxLength: 32 },
    notes: { type: ["string", "null"] },
    is_completed: { type: "boolean" },
  },
  required: ["id", "user_id", "name", "started_at", "updated_at"],
  indexes: ["updated_at", "user_id", "started_at"],
};

export const workoutTemplateSchema: RxJsonSchema<WorkoutTemplateDocument> = {
  version: 3,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    owner_id: { type: "string", maxLength: 36 },
    assigned_by: { type: ["string", "null"], maxLength: 36 },
    name: { type: "string", maxLength: 200 },
    notes: { type: ["string", "null"] },
    is_public: { type: "boolean" },
    visibility: { type: "string", maxLength: 10 },
    updated_at: { type: "string", maxLength: 32 },
    folder_name: { type: ["string", "null"] },
  },
  required: ["id", "owner_id", "name", "updated_at"],
  indexes: ["updated_at", "owner_id"],
};

export const setSchema: RxJsonSchema<SetDocument> = {
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    session_id: { type: "string", maxLength: 36 },
    exercise_id: { type: "string", maxLength: 36 },
    set_number: { type: "integer" },
    set_type: {
      type: "string",
      maxLength: 10,
      enum: ["warmup", "working", "failure", "drop", "myorep"],
    },
    weight_kg: { type: ["number", "null"] },
    reps: { type: ["integer", "null"] },
    rpe: { type: ["number", "null"] },
    duration_secs: { type: ["integer", "null"] },
    distance_m: { type: ["number", "null"] },
    notes: { type: ["string", "null"] },
    logged_at: { type: "string", maxLength: 32 },
    updated_at: { type: "string", maxLength: 32 },
  },
  required: [
    "id",
    "session_id",
    "exercise_id",
    "set_number",
    "set_type",
    "logged_at",
    "updated_at",
  ],
  indexes: ["updated_at", "session_id", "exercise_id"],
};
