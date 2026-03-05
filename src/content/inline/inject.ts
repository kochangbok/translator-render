import type { TranslationResult } from '@/shared/types';
import type { InlineMappedParagraph } from './mapParagraphs';

const INLINE_MARKER = 'llmtr-inline';

export function clearInlineInjected(): void {
  document.querySelectorAll(`[data-${INLINE_MARKER}="1"]`).forEach((node) => node.remove());
}

export function injectInlinePlaceholders(mapped: InlineMappedParagraph[]): void {
  mapped.forEach(({ node, block }) => {
    if ((node.nextElementSibling as HTMLElement | null)?.dataset?.[INLINE_MARKER] === '1') {
      return;
    }

    const translated = document.createElement('div');
    translated.dataset[INLINE_MARKER] = '1';
    translated.dataset.blockId = block.id;
    translated.className = 'llmtr-inline-translation llmtr-loading';
    translated.textContent = '번역 대기 중...';
    node.insertAdjacentElement('afterend', translated);
  });
}

export function updateInlineTranslations(items: TranslationResult[]): void {
  items.forEach((item) => {
    const node = document.querySelector<HTMLElement>(`[data-${INLINE_MARKER}="1"][data-block-id="${item.id}"]`);
    if (!node) return;
    node.classList.remove('llmtr-loading', 'llmtr-error');
    node.textContent = item.ko;
  });
}

export function markInlineError(blockId: string, message: string): void {
  const node = document.querySelector<HTMLElement>(`[data-${INLINE_MARKER}="1"][data-block-id="${blockId}"]`);
  if (!node) return;
  node.classList.remove('llmtr-loading');
  node.classList.add('llmtr-error');
  node.textContent = `오류: ${message}`;
}
