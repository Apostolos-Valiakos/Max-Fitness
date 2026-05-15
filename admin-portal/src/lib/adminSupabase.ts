import { createClient } from '@supabase/supabase-js'

const url        = import.meta.env.VITE_SUPABASE_URL
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!url || !serviceKey) {
  throw new Error('[adminSupabase] Missing VITE_SUPABASE_SERVICE_KEY')
}

// Service-role client — bypasses RLS, can read auth.users
export const adminSupabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function listAuthUsers(): Promise<{ id: string; email: string; created_at: string; last_sign_in_at: string | null }[]> {
  const { data, error } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return (data?.users ?? []).map(u => ({
    id:              u.id,
    email:           u.email ?? '',
    created_at:      u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }))
}
