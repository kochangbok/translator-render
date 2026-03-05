export type ProviderId = 'openai' | 'custom';
export type AuthType = 'apiKey' | 'oauth' | 'proxy';
export type RenderMode = 'reader' | 'inline';

export interface ParagraphBlock {
  id: string;
  text: string;
  type: 'p' | 'li' | 'h2' | 'h3' | 'blockquote' | 'unknown';
  meta?: {
    headingPath?: string;
  };
}

export interface ArticleContext {
  url: string;
  title?: string;
  siteName?: string;
  langHint?: 'en' | 'zh' | 'auto';
  headings?: string[];
  excerpt?: string;
  blocks: ParagraphBlock[];
}

export interface TranslationResult {
  id: string;
  ko: string;
  confidence?: number;
  flags?: string[];
}

export interface PreparedContext {
  summary: string;
  glossary: Record<string, string>;
}

export interface ExtensionSettings {
  providerId: ProviderId;
  authType: AuthType;
  apiKey: string;
  model: string;
  endpoint: string;
  proxyUrl: string;
  targetLang: 'ko';
  chunkSize: number;
  mode: RenderMode;
  temperature: number;
  maxRetries: number;
}

export interface TranslateChunkPayload {
  article: Pick<ArticleContext, 'url' | 'title' | 'siteName' | 'headings' | 'langHint'>;
  blocks: ParagraphBlock[];
  neighborContext: string[];
  preparedContext: PreparedContext;
}

export type RuntimeMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<ExtensionSettings> }
  | { type: 'CLEAR_CACHE' }
  | { type: 'TEST_PROVIDER' }
  | { type: 'PREPARE_DOCUMENT'; payload: ArticleContext }
  | { type: 'TRANSLATE_CHUNK'; payload: TranslateChunkPayload };

export interface RuntimeSuccess<T> {
  ok: true;
  data: T;
}

export interface RuntimeError {
  ok: false;
  error: string;
}

export type RuntimeResponse<T> = RuntimeSuccess<T> | RuntimeError;

export interface CachedTranslationItem {
  key: string;
  id: string;
  value: string;
  updatedAt: number;
}
