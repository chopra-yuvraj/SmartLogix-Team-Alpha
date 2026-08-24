/**
 * SmartLogix — Supabase Browser Client (Task 5.2)
 *
 * For use in Client Components only. Never exposes the service-role key.
 * Server components use lib/supabase-server.ts instead.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
