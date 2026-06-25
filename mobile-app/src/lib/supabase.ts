import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// In a native Capacitor context (iOS/Android WebView) the LAN IP is needed to
// reach the dev machine. In a desktop browser (dev, E2E tests) requests from
// localhost to a LAN IP are blocked by Chromium's Private Network Access (PNA)
// policy, so we rewrite to 127.0.0.1 at runtime to avoid the restriction.
function resolveUrl(raw: string): string {
  const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
  if (isNative) return raw
  try {
    const u = new URL(raw)
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      u.hostname = '127.0.0.1'
      return u.origin
    }
  } catch {}
  return raw
}

const SUPABASE_URL = resolveUrl(rawUrl)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
