import { createClient } from "@supabase/supabase-js";

export const createSupabaseAdminClient = (url?: string, key?: string) => {
  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
