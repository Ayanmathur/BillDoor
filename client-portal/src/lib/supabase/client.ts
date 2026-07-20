/**
 * BillDoor — Supabase Browser Client
 * 
 * SECURITY: Only the anon key is used client-side.
 * The service_role key NEVER appears in this file.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
