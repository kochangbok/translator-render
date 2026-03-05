import { chunkArray } from '@/shared/chunk';
import { buildBlockCacheKey } from '@/shared/hash';
import { loadSettings, saveSettings } from '@/shared/storage';
import type {
  ArticleContext,
  ExtensionSettings,
  ParagraphBlock,
  PreparedContext,
  PublicExtensionSettings,
  RuntimeMessage,
  RuntimeResponse,
  TranslationResult
} from '@/shared/types';
import { clearOAuthToken, getOAuthAccessToken, getOAuthTokenState, startOAuthLogin } from './auth/oauth';
import { clearTranslationCache, getCachedTranslations, setCachedTranslations } from './cache/storage';
import { createProvider } from './providers';

class RequestQueue {
  private chain = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task);
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

const queue = new RequestQueue();

async function withRetries<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function buildNeighborContext(blocks: ParagraphBlock[], currentIndex: number): string[] {
  const prev = blocks[currentIndex - 1]?.text;
  const next = blocks[currentIndex + 1]?.text;
  return [prev, next].filter(Boolean) as string[];
}

function toPublicSettings(settings: ExtensionSettings): PublicExtensionSettings {
  return {
    providerId: settings.providerId,
    authType: settings.authType,
    mode: settings.mode,
    chunkSize: settings.chunkSize,
    excludedDomains: settings.excludedDomains
  };
}

async function getProviderSettings(): Promise<ExtensionSettings> {
  const settings = await loadSettings();

  if (settings.authType !== 'oauth') {
    return settings;
  }

  const oauthToken = await getOAuthAccessToken(settings);
  if (!oauthToken) {
    throw new Error('OAuth 토큰이 없습니다. 옵션에서 OAuth 로그인 후 다시 시도하세요.');
  }

  return {
    ...settings,
    apiKey: oauthToken
  };
}

async function prepareDocument(article: ArticleContext): Promise<PreparedContext> {
  const settings = await getProviderSettings();
  const provider = createProvider(settings);

  return provider.prepareContext({ article });
}

async function testProviderConnection(): Promise<{ provider: string; model: string; sample: string }> {
  const settings = await getProviderSettings();
  const provider = createProvider(settings);

  const results = await withRetries(
    () =>
      provider.translateChunk({
        article: {
          url: 'about:blank',
          title: 'Connection Test',
          siteName: 'llmtr'
        },
        blocks: [
          {
            id: 'sample',
            text: 'This is a connection test. Please translate this sentence into Korean.',
            type: 'p'
          }
        ],
        preparedContext: {
          summary: 'Connection test',
          glossary: {}
        },
        neighborContext: []
      }),
    settings.maxRetries
  );

  return {
    provider: settings.providerId,
    model: settings.model,
    sample: results[0]?.ko ?? ''
  };
}

async function translateChunk(payload: {
  article: Pick<ArticleContext, 'url' | 'title' | 'siteName' | 'headings' | 'langHint'>;
  blocks: ParagraphBlock[];
  preparedContext: PreparedContext;
  neighborContext: string[];
}): Promise<TranslationResult[]> {
  const settings = await getProviderSettings();
  const provider = createProvider(settings);

  const cacheKeys = payload.blocks.map((block) => buildBlockCacheKey(payload.article.url, block.id, block.text));
  const cacheMap = await getCachedTranslations(cacheKeys);

  const cachedResults: TranslationResult[] = [];
  const missingBlocks: ParagraphBlock[] = [];

  payload.blocks.forEach((block) => {
    const key = buildBlockCacheKey(payload.article.url, block.id, block.text);
    const cached = cacheMap[key];
    if (cached) {
      cachedResults.push({ id: block.id, ko: cached });
    } else {
      missingBlocks.push(block);
    }
  });

  if (!missingBlocks.length) {
    return cachedResults;
  }

  const missingIndex = payload.blocks.findIndex((block) => block.id === missingBlocks[0].id);
  const neighborContext =
    payload.neighborContext.length > 0
      ? payload.neighborContext
      : buildNeighborContext(payload.blocks, Math.max(missingIndex, 0));

  const remoteResults = await withRetries(
    () =>
      provider.translateChunk({
        article: payload.article,
        blocks: missingBlocks,
        preparedContext: payload.preparedContext,
        neighborContext
      }),
    settings.maxRetries
  );

  await setCachedTranslations(
    remoteResults.map((item) => {
      const sourceBlock = missingBlocks.find((block) => block.id === item.id);
      return {
        key: buildBlockCacheKey(payload.article.url, item.id, sourceBlock?.text ?? ''),
        id: item.id,
        value: item.ko,
        updatedAt: Date.now()
      };
    })
  );

  return [...cachedResults, ...remoteResults];
}

function ok<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function fail(error: unknown): RuntimeResponse<never> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { ok: false, error: message };
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _, sendResponse) => {
  queue
    .run(async () => {
      switch (message.type) {
        case 'GET_SETTINGS': {
          const settings = await loadSettings();
          return ok(settings);
        }
        case 'GET_PUBLIC_SETTINGS': {
          const settings = await loadSettings();
          return ok(toPublicSettings(settings));
        }
        case 'SAVE_SETTINGS': {
          const settings = await saveSettings(message.payload);
          return ok(settings);
        }
        case 'CLEAR_CACHE': {
          await clearTranslationCache();
          return ok({ cleared: true });
        }
        case 'TEST_PROVIDER': {
          const data = await testProviderConnection();
          return ok(data);
        }
        case 'OAUTH_LOGIN': {
          const settings = await loadSettings();
          if (settings.authType !== 'oauth') {
            throw new Error('Auth Type을 OAuth로 변경한 뒤 시도하세요.');
          }
          const data = await startOAuthLogin(settings);
          return ok(data);
        }
        case 'OAUTH_LOGOUT': {
          await clearOAuthToken();
          return ok({ disconnected: true });
        }
        case 'OAUTH_STATUS': {
          const settings = await loadSettings();
          if (settings.authType !== 'oauth') {
            return ok({ connected: false, hasRefreshToken: false });
          }
          const state = await getOAuthTokenState(settings);
          return ok(state);
        }
        case 'PREPARE_DOCUMENT': {
          const data = await prepareDocument(message.payload);
          return ok(data);
        }
        case 'TRANSLATE_CHUNK': {
          const data = await translateChunk(message.payload);
          return ok(data);
        }
        default:
          return fail(new Error('지원하지 않는 메시지입니다.'));
      }
    })
    .then(sendResponse)
    .catch((error) => sendResponse(fail(error)));

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await loadSettings();
  if (settings.chunkSize < 2 || settings.chunkSize > 20) {
    await saveSettings({ chunkSize: 8 });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-translation') return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_TRANSLATION' });
  } catch {
    // no-op
  }
});

export function chunkForDebug<T>(items: T[], size: number): T[][] {
  return chunkArray(items, size);
}
