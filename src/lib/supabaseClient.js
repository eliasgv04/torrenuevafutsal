import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || ''

// Custom fetch: 60-second HTTP timeout instead of the browser default.
// NOTE: to also remove the PostgreSQL statement_timeout (server-side), run this once
// in your Supabase SQL editor:  ALTER DATABASE postgres SET statement_timeout = 0;
export function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000) // 60 s
  const init   = options?.signal
    ? options                                         // caller already has a signal, don't override
    : { ...options, signal: controller.signal }
  return fetch(url, init).finally(() => clearTimeout(timer))
}

export const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { fetch: fetchWithTimeout }
    })
  : null
