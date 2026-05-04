import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || ''

// If env vars are empty, supabase client will fail but api.js has try-catch fallback to localStorage
export const supabase = SUPABASE_URL && SUPABASE_ANON 
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null
