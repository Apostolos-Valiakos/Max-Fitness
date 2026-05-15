// Stub for supabase.ts import
export interface Database { public: { Tables: Record<string, never>; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never> } }

export type UserRole = 'user' | 'trainer' | 'admin'
export type UserTier = 'free' | 'paid' | 'ultra'
export type BodyPart = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'full_body'
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell' | 'band' | 'other'

export interface Profile {
  id: string
  role: UserRole
  tier: UserTier
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

export interface UserRow extends Profile {
  email: string
  last_sign_in_at: string | null
}

export interface Exercise {
  id: string
  name: string
  body_part: BodyPart
  equipment: Equipment
  image_url: string | null
  instructions: string | null
  is_custom: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  target_muscle: string | null
  secondary_muscles: string[] | null
  sticky_note: string | null
}

export interface BodyMeasurement {
  id: string
  user_id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  left_arm_cm: number | null
  right_arm_cm: number | null
  left_thigh_cm: number | null
  right_thigh_cm: number | null
  notes: string | null
  updated_at: string
}

export interface WorkoutSession {
  id: string
  user_id: string
  template_id: string | null
  name: string
  started_at: string
  finished_at: string | null
  updated_at: string
  notes: string | null
}

export interface TrainerAssignment {
  id: string
  trainer_id: string
  client_id: string
  assigned_at: string
  is_active: boolean
}

export interface TrainerRow extends Profile {
  email: string
  clients: ClientRow[]
}

export interface ClientRow extends Profile {
  email: string
  assignment_id: string
  assigned_at: string
}
