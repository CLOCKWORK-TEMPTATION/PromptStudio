// @ts-nocheck
// Stub for Supabase client
// Install @supabase/supabase-js if needed: npm install @supabase/supabase-js

// Type stub for Supabase client
interface SupabaseQueryResult<T = Record<string, unknown>> {
  data: T[] | null;
  error: Error | null;
}

interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder & Promise<SupabaseQueryResult>;
  insert: (data: Record<string, unknown>) => SupabaseQueryBuilder & Promise<SupabaseQueryResult>;
  update: (data: Record<string, unknown>) => SupabaseQueryBuilder & Promise<SupabaseQueryResult>;
  delete: () => SupabaseQueryBuilder & Promise<SupabaseQueryResult>;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder & Promise<SupabaseQueryResult>;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder & Promise<SupabaseQueryResult>;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
  single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
  then: <TResult>(onfulfilled?: ((value: SupabaseQueryResult) => TResult | PromiseLike<TResult>) | null) => Promise<TResult>;
}

interface SupabaseClient {
  from: (table: string) => SupabaseQueryBuilder;
}

// Create a mock Supabase client stub
const createMockQueryBuilder = (): SupabaseQueryBuilder => {
  const builder: SupabaseQueryBuilder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
  };
  return builder;
};

const mockSupabase: SupabaseClient = {
  from: () => createMockQueryBuilder(),
};

// Export null for runtime check, but type as SupabaseClient for type safety
export const supabase: SupabaseClient | null = null;

// Stub functions for session management
export async function getOrCreateSession(): Promise<string> {
  // Return a mock session token
  return 'mock-session-token';
}

export async function getSessionId(token: string): Promise<string | null> {
  // Return a mock session ID
  return token ? 'mock-session-id' : null;
}

export default supabase;
