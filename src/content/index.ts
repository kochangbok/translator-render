import { chunkArray } from '@/shared/chunk';
import { loadSettings } from '@/shared/storage';
import type {
  ArticleContext,
  ParagraphBlock,
  PreparedContext,
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

async function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

function neighborContextFromBlocks(all: ParagraphBlock[], index: number): string[] {
  const prev = all[index - 1]?.text;
  const next = all[index + 1]?.text;
  return [prev, next].filter(Boolean) as string[];
}

async function translateReader(article: ArticleContext, runId: number): Promise<void> {
  const overlay = renderReaderOverlay(article);

  try {
    overlay.updateStatus('문서 컨텍스트 준비 중...');
    const settings = await loadSettings();
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

async function translateInline(article: ArticleContext, runId: number): Promise<void> {
  clearInlineInjected();
  const mapped = mapInlineParagraphs();
  if (!mapped.length) {
    throw new Error('인라인 번역할 문단을 찾지 못했습니다.');
  }

  injectInlinePlaceholders(mapped);

  const settings = await loadSettings();
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
}

async function startTranslation(): Promise<void> {
  ensureReaderStyles();

  const article = extractArticleContext();
  if (!article.blocks.length) {
    throw new Error('번역 가능한 본문을 찾지 못했습니다.');
  }

  activeRunId += 1;
  const runId = activeRunId;

  const settings = await loadSettings();
  if (settings.mode === 'inline') {
    await translateInline(article, runId);
  } else {
    await translateReader(article, runId);
  }
}

function stopTranslation(): void {
  activeRunId += 1;
  removeOverlay();
  clearInlineInjected();
}

chrome.runtime.onMessage.addListener((message: { type: 'START_TRANSLATION' | 'STOP_TRANSLATION' }, _, sendResponse) => {
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

  return false;
});

if (getExistingOverlay()) {
  removeOverlay();
}
