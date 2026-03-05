import { hashString } from '@/shared/hash';
import type { ParagraphBlock } from '@/shared/types';

export interface InlineMappedParagraph {
  node: Element;
  block: ParagraphBlock;
}

export function mapInlineParagraphs(limit = 80): InlineMappedParagraph[] {
  const root = document.querySelector('article, main, [role="main"]') ?? document.body;
  const nodes = Array.from(root.querySelectorAll('p, li')).slice(0, limit);

  return nodes
    .map((node, index) => {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 20) return null;

      return {
        node,
        block: {
          id: `${index}:${hashString(text).slice(0, 6)}`,
          text,
          type: node.tagName.toLowerCase() as ParagraphBlock['type']
        }
      } satisfies InlineMappedParagraph;
    })
    .filter(Boolean) as InlineMappedParagraph[];
}
