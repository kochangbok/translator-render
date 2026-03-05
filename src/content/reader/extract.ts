import { Readability } from '@mozilla/readability';
import { hashString } from '@/shared/hash';
import type { ArticleContext, ParagraphBlock } from '@/shared/types';

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractBlocksFromHtml(html: string): ParagraphBlock[] {
  const doc = new DOMParser().parseFromString(`<article>${html}</article>`, 'text/html');
  const nodes = Array.from(doc.querySelectorAll('p, li, h2, h3, blockquote'));

  const blocks: ParagraphBlock[] = [];
  let currentHeadingPath = '';

  nodes.forEach((node, index) => {
    const text = normalizeText(node.textContent ?? '');
    if (!text || text.length < 20) return;

    const tag = node.tagName.toLowerCase();
    if (tag === 'h2' || tag === 'h3') {
      currentHeadingPath = text;
    }

    blocks.push({
      id: `${index}:${hashString(text).slice(0, 6)}`,
      text,
      type: tag as ParagraphBlock['type'],
      meta: currentHeadingPath ? { headingPath: currentHeadingPath } : undefined
    });
  });

  return blocks;
}

function fallbackExtractFromPage(): ParagraphBlock[] {
  const roots = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('#content'),
    document.body
  ].filter(Boolean) as Element[];

  const root = roots[0];
  if (!root) return [];

  const candidates = Array.from(root.querySelectorAll('p, li, h2, h3, blockquote')).slice(0, 120);
  return candidates
    .map((node, index) => {
      const text = normalizeText(node.textContent ?? '');
      if (!text || text.length < 20) return null;

      const tag = node.tagName.toLowerCase();
      return {
        id: `${index}:${hashString(text).slice(0, 6)}`,
        text,
        type: tag as ParagraphBlock['type']
      } satisfies ParagraphBlock;
    })
    .filter(Boolean) as ParagraphBlock[];
}

export function extractArticleContext(): ArticleContext {
  const cloned = document.cloneNode(true) as Document;
  const parsed = new Readability(cloned).parse();

  const title = parsed?.title || document.title;
  const html = parsed?.content ?? '';

  const blocks = html ? extractBlocksFromHtml(html) : fallbackExtractFromPage();
  const headings = blocks
    .filter((block) => block.type === 'h2' || block.type === 'h3')
    .map((block) => block.text)
    .slice(0, 20);

  const lang = document.documentElement.lang || '';
  const langHint: ArticleContext['langHint'] = lang.startsWith('zh') ? 'zh' : lang.startsWith('en') ? 'en' : 'auto';

  return {
    url: location.href,
    title,
    siteName: location.hostname,
    langHint,
    headings,
    excerpt: blocks.slice(0, 3).map((block) => block.text).join(' ').slice(0, 240),
    blocks
  };
}
