import type { ExtensionSettings } from './types';

export const SETTINGS_STORAGE_KEY = 'llmtr_settings_v1';

export const TRANSLATION_CACHE_STORAGE_KEY = 'llmtr_translation_cache_v1';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  providerId: 'openai',
  authType: 'apiKey',
  apiKey: '',
  model: 'gpt-4o-mini',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  proxyUrl: '',
  targetLang: 'ko',
  chunkSize: 8,
  mode: 'reader',
  temperature: 0.2,
  maxRetries: 2
};

export const MAX_CACHE_ENTRIES = 5000;
