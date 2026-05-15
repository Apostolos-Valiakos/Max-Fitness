/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_ENV: string
  readonly VITE_APP_NAME: string
  readonly VITE_RXDB_SYNC_DAYS: string
  readonly VITE_RXDB_PULL_INTERVAL: string
  readonly VITE_DEV_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
