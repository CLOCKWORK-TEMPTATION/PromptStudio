// Simple in-memory cache for translation results
const translationCache = new Map<string, string>();

export async function cacheTranslation(key: string, value?: string): Promise<string | undefined> {
  if (typeof value === 'undefined') {
    return translationCache.get(key);
  }
  translationCache.set(key, value);
  return value;
}
