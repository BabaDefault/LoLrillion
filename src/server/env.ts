export interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

/**
 * Supabase settings from the environment, or null to use the in-memory store (local dev, tests).
 * Throws if only one of the two variables is set, so a misconfigured deploy fails loudly.
 */
export function supabaseEnv(env: Record<string, string | undefined>): SupabaseEnv | null {
  const url = env.SUPABASE_URL || undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || undefined;
  if (!url && !serviceRoleKey) return null;
  if (!url) throw new Error("SUPABASE_SERVICE_ROLE_KEY is set but SUPABASE_URL is missing");
  if (!serviceRoleKey) throw new Error("SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing");
  return { url, serviceRoleKey };
}
