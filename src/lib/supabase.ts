import { createClient } from '@supabase/supabase-js';

// Read configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key';

/**
 * Supabase client initialized with the public anon/publishable key.
 * Security Note: Never expose service_role or admin secrets on the client.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
