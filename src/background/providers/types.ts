import type { ArticleContext, ExtensionSettings, ParagraphBlock, PreparedContext, TranslationResult } from '@/shared/types';

export interface PrepareContextInput {
  article: ArticleContext;
}

export interface TranslateChunkInput {
  article: Pick<ArticleContext, 'url' | 'title' | 'siteName' | 'headings' | 'langHint'>;
  blocks: ParagraphBlock[];
  preparedContext: PreparedContext;
  neighborContext: string[];
}

export interface ProviderAdapter {
  id: string;
  prepareContext(input: PrepareContextInput): Promise<PreparedContext>;
  translateChunk(input: TranslateChunkInput): Promise<TranslationResult[]>;
}

export interface ProviderFactoryInput {
  settings: ExtensionSettings;
}
