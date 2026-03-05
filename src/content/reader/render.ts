import type { ArticleContext } from '@/shared/types';

const OVERLAY_ID = 'llmtr-reader-overlay';

export interface ReaderOverlayHandle {
  updateStatus(text: string): void;
  updateTranslation(blockId: string, text: string): void;
  markError(blockId: string, message: string): void;
  destroy(): void;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getExistingOverlay(): HTMLElement | null {
  return document.getElementById(OVERLAY_ID);
}

export function removeOverlay(): void {
  getExistingOverlay()?.remove();
}

export function renderReaderOverlay(article: ArticleContext): ReaderOverlayHandle {
  removeOverlay();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('data-llmtr', '1');

  const blockHtml = article.blocks
    .map(
      (block) => `
      <section class="llmtr-block" data-block-id="${block.id}">
        <div class="llmtr-src">${escapeHtml(block.text)}</div>
        <div class="llmtr-tr llmtr-loading" data-llmtr="1">번역 대기 중...</div>
      </section>`
    )
    .join('');

  overlay.innerHTML = `
    <div class="llmtr-shell">
      <header class="llmtr-header">
        <div>
          <strong>Reader 번역</strong>
          <span class="llmtr-title">${escapeHtml(article.title ?? location.hostname)}</span>
        </div>
        <div class="llmtr-header-actions">
          <span class="llmtr-status" id="llmtr-status">준비 중...</span>
          <button type="button" id="llmtr-close">닫기</button>
        </div>
      </header>
      <main class="llmtr-main">${blockHtml}</main>
    </div>
  `;

  const closeButton = overlay.querySelector<HTMLButtonElement>('#llmtr-close');
  closeButton?.addEventListener('click', () => removeOverlay());

  document.documentElement.appendChild(overlay);
  document.documentElement.style.overflow = 'hidden';

  const cleanup = () => {
    if (!document.getElementById(OVERLAY_ID)) {
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    }
  };

  const onEsc = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      removeOverlay();
      cleanup();
    }
  };

  window.addEventListener('keydown', onEsc);

  return {
    updateStatus(text: string) {
      const status = overlay.querySelector<HTMLElement>('#llmtr-status');
      if (status) status.textContent = text;
    },
    updateTranslation(blockId: string, text: string) {
      const block = overlay.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .llmtr-tr`);
      if (!block) return;
      block.classList.remove('llmtr-loading', 'llmtr-error');
      block.textContent = text;
    },
    markError(blockId: string, message: string) {
      const block = overlay.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .llmtr-tr`);
      if (!block) return;
      block.classList.remove('llmtr-loading');
      block.classList.add('llmtr-error');
      block.textContent = `오류: ${message}`;
    },
    destroy() {
      removeOverlay();
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    }
  };
}
