// @ts-nocheck
// Stub for Supabase client
// Install @supabase/supabase-js if needed: npm install @supabase/supabase-js

// Type definition for Supabase-like query builder
interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

// Use a simpler approach - single type parameter that gets modified by methods
interface QueryBuilder<T> {
  select(columns?: string): QueryBuilder<T>;
  insert(data: unknown): QueryBuilder<T>;
  update(data: unknown): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  or(filter: string): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T | null>>;
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

interface SupabaseClient {
  from<T = unknown>(table: string): QueryBuilder<T>;
}

// Create a stub client that throws helpful errors
const createStubClient = (): SupabaseClient => {
  const createQueryBuilder = <T>(): QueryBuilder<T> => {
    const builder: QueryBuilder<T> = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      eq: () => builder,
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured') }),
      maybeSingle: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured') }),
      then: (onfulfilled) => {
        const result: QueryResult<T> = { data: null, error: new Error('Supabase client not configured') };
        return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
      },
    };
    return builder;
  };

  return {
    from: <T>() => createQueryBuilder<T>(),
  };
};

export const supabase: SupabaseClient = createStubClient();

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
