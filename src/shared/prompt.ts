import type { ParagraphBlock, PreparedContext } from './types';

export function buildPreparationPrompt(input: {
  title?: string;
  url: string;
  headings?: string[];
  text: string;
}) {
  const system = [
    '당신은 전문 번역 보조자입니다.',
    '주어진 문서를 한국어 번역하기 전에 짧은 요약과 용어집을 작성하세요.',
    '반드시 JSON 객체만 출력하세요.'
  ].join(' ');

  const user = [
    `URL: ${input.url}`,
    `TITLE: ${input.title ?? ''}`,
    `HEADINGS: ${(input.headings ?? []).join(' | ')}`,
    'DOCUMENT:',
    input.text
  ].join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      glossary: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            source: { type: 'string' },
            target: { type: 'string' }
          },
          required: ['source', 'target']
        }
      }
    },
    required: ['summary', 'glossary']
  };

  return { system, user, schema };
}

export function buildChunkTranslationPrompt(input: {
  title?: string;
  url: string;
  summary: string;
  glossary: Record<string, string>;
  neighborContext: string[];
  blocks: ParagraphBlock[];
}) {
  const glossaryLines = Object.entries(input.glossary)
    .slice(0, 30)
    .map(([source, target]) => `- ${source} => ${target}`)
    .join('\n');

  const system = [
    '당신은 정확한 한영/중한 번역가입니다.',
    '원문 의미, 숫자, 고유명사를 보존하고 한국어를 자연스럽게 작성하세요.',
    '반드시 JSON 객체만 출력하세요.',
    '입력 블록의 id를 그대로 유지하세요.'
  ].join(' ');

  const blockLines = input.blocks
    .map((block) => `id=${block.id}\ntext=${block.text}`)
    .join('\n\n');

  const user = [
    `URL: ${input.url}`,
    `TITLE: ${input.title ?? ''}`,
    `SUMMARY: ${input.summary}`,
    `NEIGHBOR_CONTEXT: ${input.neighborContext.join(' / ')}`,
    'GLOSSARY:',
    glossaryLines || '(empty)',
    'TARGET_BLOCKS:',
    blockLines
  ].join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      translations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            ko: { type: 'string' }
          },
          required: ['id', 'ko']
        }
      }
    },
    required: ['translations']
  };

  return { system, user, schema };
}
