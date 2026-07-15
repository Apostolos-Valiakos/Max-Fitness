import { supabase } from './supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

// Calls a service-role Edge Function with the caller's own session JWT —
// the function verifies the JWT and the caller's role itself, so no
// service-role key ever needs to exist in this bundle. Replaces the old
// adminSupabase client (see git history) that shipped VITE_SUPABASE_SERVICE_KEY
// straight into the browser.
export async function callAdminFunction<T>(name: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body ?? {}),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `${name} failed (${res.status})`)
  return json as T
}

// For functions that must work before login (e.g. viewing an invite by its
// token) — no Authorization header, no session required.
export async function callPublicFunction<T>(name: string, body?: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body ?? {}),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `${name} failed (${res.status})`)
  return json as T
}
