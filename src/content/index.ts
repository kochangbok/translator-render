import { chunkArray } from '@/shared/chunk';
import type {
  ArticleContext,
  ParagraphBlock,
  PreparedContext,
  PublicExtensionSettings,
  RuntimeMessage,
  RuntimeResponse,
  TranslationResult
} from '@/shared/types';
import { ensureReaderStyles } from './dom/styleText';
import { clearInlineInjected, injectInlinePlaceholders, markInlineError, updateInlineTranslations } from './inline/inject';
import { mapInlineParagraphs } from './inline/mapParagraphs';
import { extractArticleContext } from './reader/extract';
import { getExistingOverlay, removeOverlay, renderReaderOverlay } from './reader/render';

let activeRunId = 0;
let isTranslationActive = false;
let activeMode: 'reader' | 'inline' | null = null;
let inlineObserver: MutationObserver | null = null;
let inlineRefreshTimer: number | null = null;

function isRenderedUiPresent(): boolean {
  if (activeMode === 'reader') {
    return Boolean(getExistingOverlay());
  }

  if (activeMode === 'inline') {
    return Boolean(document.querySelector('[data-llmtr-inline=\"1\"]'));
  }

  return false;
}

function stopInlineObserver(): void {
  if (inlineObserver) {
    inlineObserver.disconnect();
    inlineObserver = null;
  }

  if (inlineRefreshTimer != null) {
    window.clearTimeout(inlineRefreshTimer);
    inlineRefreshTimer = null;
  }
}

function hasMeaningfulMutation(mutations: MutationRecord[]): boolean {
  return mutations.some((mutation) => {
    if (mutation.type !== 'childList' || !mutation.addedNodes.length) return false;

    return Array.from(mutation.addedNodes).some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.dataset.llmtrInline === '1') return false;
      if (node.closest('#llmtr-reader-overlay')) return false;
      if (node.querySelector('[data-llmtr-inline="1"]')) return false;

      const text = (node.textContent ?? '').trim();
      return text.length > 40;
    });
  });
}

function scheduleInlineRefresh(): void {
  if (!isTranslationActive || activeMode !== 'inline') return;

  if (inlineRefreshTimer != null) {
    window.clearTimeout(inlineRefreshTimer);
  }

  inlineRefreshTimer = window.setTimeout(() => {
    startTranslation(true).catch((error) => {
      console.warn('[llmtr] inline refresh failed', error);
    });
  }, 1400);
}

function startInlineObserver(): void {
  if (inlineObserver || !isTranslationActive || activeMode !== 'inline') return;

  inlineObserver = new MutationObserver((mutations) => {
    if (hasMeaningfulMutation(mutations)) {
      scheduleInlineRefresh();
    }
  });

  inlineObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

async function getPublicSettings(): Promise<PublicExtensionSettings> {
  return sendRuntimeMessage<PublicExtensionSettings>({ type: 'GET_PUBLIC_SETTINGS' });
}

function neighborContextFromBlocks(all: ParagraphBlock[], index: number): string[] {
  const prev = all[index - 1]?.text;
  const next = all[index + 1]?.text;
  return [prev, next].filter(Boolean) as string[];
}

async function translateReader(article: ArticleContext, runId: number, settings: PublicExtensionSettings): Promise<void> {
  const overlay = renderReaderOverlay(article);

  try {
    overlay.updateStatus('문서 컨텍스트 준비 중...');
    const prepared = await sendRuntimeMessage<PreparedContext>({
      type: 'PREPARE_DOCUMENT',
      payload: article
    });

    const chunks = chunkArray(article.blocks, settings.chunkSize);
    for (let i = 0; i < chunks.length; i += 1) {
      if (runId !== activeRunId) return;
      const blocks = chunks[i];
      overlay.updateStatus(`번역 중... ${i + 1}/${chunks.length}`);

      const neighborContext = neighborContextFromBlocks(article.blocks, i * settings.chunkSize);

      try {
        const translations = await sendRuntimeMessage<TranslationResult[]>({
          type: 'TRANSLATE_CHUNK',
          payload: {
            article,
            blocks,
            preparedContext: prepared,
            neighborContext
          }
        });

        translations.forEach((item) => {
          overlay.updateTranslation(item.id, item.ko);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '번역 실패';
        blocks.forEach((block) => overlay.markError(block.id, message));
      }
    }

    overlay.updateStatus('완료');
  } catch (error) {
    overlay.updateStatus('실패');
    const message = error instanceof Error ? error.message : '처리 실패';
    article.blocks.forEach((block) => overlay.markError(block.id, message));
  }
}

async function translateInline(article: ArticleContext, runId: number, settings: PublicExtensionSettings): Promise<void> {
  stopInlineObserver();

  clearInlineInjected();
  const mapped = mapInlineParagraphs();
  if (!mapped.length) {
    throw new Error('인라인 번역할 문단을 찾지 못했습니다.');
  }

  injectInlinePlaceholders(mapped);

  const prepared = await sendRuntimeMessage<PreparedContext>({
    type: 'PREPARE_DOCUMENT',
    payload: article
  });

  const chunked = chunkArray(mapped, settings.chunkSize);

  for (let i = 0; i < chunked.length; i += 1) {
    if (runId !== activeRunId) return;

    const group = chunked[i];
    try {
      const translations = await sendRuntimeMessage<TranslationResult[]>({
        type: 'TRANSLATE_CHUNK',
        payload: {
          article,
          blocks: group.map((item) => item.block),
          preparedContext: prepared,
          neighborContext: neighborContextFromBlocks(article.blocks, i * settings.chunkSize)
        }
      });

      updateInlineTranslations(translations);
    } catch (error) {
      const message = error instanceof Error ? error.message : '번역 실패';
      group.forEach((item) => markInlineError(item.block.id, message));
    }
  }

  if (runId === activeRunId) {
    startInlineObserver();
  }
}

async function startTranslation(forceRestart = false): Promise<void> {
  ensureReaderStyles();

  if (forceRestart) {
    stopTranslation(false);
  } else if (isTranslationActive && isRenderedUiPresent()) {
    return;
  } else if (isTranslationActive) {
    isTranslationActive = false;
    activeMode = null;
    stopInlineObserver();
  }

  const article = extractArticleContext();
  if (!article.blocks.length) {
    throw new Error('번역 가능한 본문을 찾지 못했습니다.');
  }

  activeRunId += 1;
  const runId = activeRunId;

  const settings = await getPublicSettings();
  isTranslationActive = true;
  activeMode = settings.mode;

  try {
    if (settings.mode === 'inline') {
      await translateInline(article, runId, settings);
    } else {
      await translateReader(article, runId, settings);
    }
  } catch (error) {
    if (runId === activeRunId) {
      isTranslationActive = false;
      activeMode = null;
      stopInlineObserver();
    }
    throw error;
  }
}

function stopTranslation(incrementRunId = true): void {
  if (incrementRunId) {
    activeRunId += 1;
  }
  isTranslationActive = false;
  activeMode = null;
  stopInlineObserver();
  removeOverlay();
  clearInlineInjected();
}

chrome.runtime.onMessage.addListener(
  (
    message: {
      type:
        | 'START_TRANSLATION'
        | 'STOP_TRANSLATION'
        | 'TOGGLE_TRANSLATION'
        | 'PING_TRANSLATION_STATE';
    },
    _,
    sendResponse
  ) => {
    if (message.type === 'START_TRANSLATION') {
      startTranslation()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : '실패' }));
      return true;
    }

    if (message.type === 'STOP_TRANSLATION') {
      stopTranslation();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'TOGGLE_TRANSLATION') {
      const willActivate = !isTranslationActive;
      const task = willActivate ? startTranslation() : Promise.resolve(stopTranslation());
      task
        .then(() => sendResponse({ ok: true, active: willActivate }))
        .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : '실패' }));
      return true;
    }

    if (message.type === 'PING_TRANSLATION_STATE') {
      sendResponse({ ok: true, active: isTranslationActive, mode: activeMode });
      return false;
    }

    return false;
  }
);

window.addEventListener('llmtr-reader-closed', () => {
  if (activeMode === 'reader') {
    stopTranslation();
  }
});

if (getExistingOverlay()) {
  removeOverlay();
}
