import { MAX_CACHE_ENTRIES, TRANSLATION_CACHE_STORAGE_KEY } from '@/shared/defaults';
import type { CachedTranslationItem } from '@/shared/types';

type CacheMap = Record<string, CachedTranslationItem>;

async function readCache(): Promise<CacheMap> {
  const result = await chrome.storage.local.get(TRANSLATION_CACHE_STORAGE_KEY);
  return (result[TRANSLATION_CACHE_STORAGE_KEY] as CacheMap | undefined) ?? {};
}

async function writeCache(cache: CacheMap): Promise<void> {
  await chrome.storage.local.set({
    [TRANSLATION_CACHE_STORAGE_KEY]: cache
  });
}

function compactCache(cache: CacheMap): CacheMap {
  const entries = Object.values(cache);
  if (entries.length <= MAX_CACHE_ENTRIES) {
    return cache;
  }

  const sorted = entries.sort((a, b) => b.updatedAt - a.updatedAt);
  const next = sorted.slice(0, MAX_CACHE_ENTRIES);

  return next.reduce<CacheMap>((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {});
}

export async function getCachedTranslations(keys: string[]): Promise<Record<string, string>> {
  const cache = await readCache();
  const found: Record<string, string> = {};
  keys.forEach((key) => {
    const item = cache[key];
    if (item) {
      found[key] = item.value;
    }
  });
  return found;
}

export async function setCachedTranslations(items: CachedTranslationItem[]): Promise<void> {
  if (!items.length) return;

  const cache = await readCache();
  items.forEach((item) => {
    cache[item.key] = item;
  });

  await writeCache(compactCache(cache));
}

export async function clearTranslationCache(): Promise<void> {
  await chrome.storage.local.remove(TRANSLATION_CACHE_STORAGE_KEY);
}
