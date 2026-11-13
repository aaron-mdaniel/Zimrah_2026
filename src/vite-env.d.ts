/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_UPSTASH_REDIS_REST_URL?: string;
  readonly VITE_UPSTASH_REDIS_REST_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
