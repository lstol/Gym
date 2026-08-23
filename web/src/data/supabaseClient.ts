import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy web/.env.example to web/.env and fill in your project values.',
  )
}

export const supabase = createClient(url, anonKey)

// Every insert into a user-owned table must set user_id explicitly — RLS's
// `with check (user_id = auth.uid())` rejects a row that omits it (there is
// no DEFAULT on that column). This reads the already-cached session, so it
// doesn't cost a network round trip.
export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const userId = data.session?.user.id
  if (!userId) throw new Error('No authenticated user')
  return userId
}
