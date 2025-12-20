import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getOrCreateSession(): Promise<string> {
  const storageKey = 'prompt_studio_session';
  let sessionToken = localStorage.getItem(storageKey);

  if (sessionToken) {
    const { data } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (data) {
      await supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('session_token', sessionToken);
      return sessionToken;
    }
  }

  sessionToken = crypto.randomUUID();
  localStorage.setItem(storageKey, sessionToken);

  await supabase.from('user_sessions').insert({
    session_token: sessionToken,
    display_name: 'Anonymous User',
    preferences: { theme: 'dark', language: 'en' },
  });

  return sessionToken;
}

export async function getSessionId(sessionToken: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_sessions')
    .select('id')
    .eq('session_token', sessionToken)
    .maybeSingle();

  return data?.id || null;
}
