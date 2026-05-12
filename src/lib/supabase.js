import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url) console.error('[supabase] VITE_SUPABASE_URL is missing from .env');
if (!key) console.error('[supabase] VITE_SUPABASE_ANON_KEY is missing from .env');
if (url && key) console.log('[supabase] Client initialised — URL:', url);

export const supabase = (url && key) ? createClient(url, key) : null;
