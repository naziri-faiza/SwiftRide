const { createClient } = require("@supabase/supabase-js");

/**
 * Initializes and exports the Supabase client
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  // Server-side operations prefer SERVICE_ROLE_KEY to perform privileged operations
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isSupabaseConfigured() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("your-project")
  );
}

module.exports = {
  getSupabaseClient,
  isSupabaseConfigured,
};
