import type { ExtensionSettings } from '@/shared/types';
import { OpenAIProvider } from './openai';
import type { ProviderAdapter } from './types';

export function createProvider(settings: ExtensionSettings): ProviderAdapter {
  switch (settings.providerId) {
    case 'openai':
    case 'custom':
      return new OpenAIProvider(settings);
    default:
      return new OpenAIProvider(settings);
  }
}
