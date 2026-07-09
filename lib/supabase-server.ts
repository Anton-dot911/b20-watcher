// Server-only Supabase client.
//
// `import "server-only"` makes any attempt to bundle this module into client
// code a build-time error, so the service-role key can never reach the browser.
// The URL and service-role key are read from the environment ONLY here.
//
// The service-role key bypasses row-level security, so this module must be
// imported exclusively from server code (the cache/refresh layer). It is never
// imported by client components.
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a memoized Supabase client built from NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Throws a clear, secret-free error when either variable is missing — this is
 * what surfaces when the app is put in DATA_SOURCE=supabase mode (or a refresh
 * endpoint is hit) without Supabase configured.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Supabase is not configured: missing ${missing}. ` +
        "These are required for DATA_SOURCE=supabase and for the refresh endpoints."
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
