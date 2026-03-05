import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './defaults';
import type { ExtensionSettings } from './types';

export async function loadSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  const saved = result[SETTINGS_STORAGE_KEY] as Partial<ExtensionSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {})
  };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const merged = {
    ...(await loadSettings()),
    ...settings
  };

  await chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: merged
  });

  return merged;
}
