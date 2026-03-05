import { buildChunkTranslationPrompt, buildPreparationPrompt } from '@/shared/prompt';
import { parseJsonWithRepair } from '@/shared/json';
import type { ArticleContext, ExtensionSettings, PreparedContext, TranslationResult } from '@/shared/types';
import type { ProviderAdapter, TranslateChunkInput } from './types';

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function isAllowedEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}

function localFallbackContext(article: ArticleContext): PreparedContext {
  const lines = article.blocks.slice(0, 8).map((block) => block.text);
  const summary = lines.join(' ').slice(0, 400);
  const glossary: Record<string, string> = {};

  const tokens = Array.from(
    new Set(
      lines
        .join(' ')
        .match(/\b([A-Z][A-Za-z0-9\-]{2,})\b/g) ?? []
    )
  ).slice(0, 12);

  tokens.forEach((token) => {
    glossary[token] = token;
  });

  return {
    summary,
    glossary
  };
}

export class OpenAIProvider implements ProviderAdapter {
  id = 'openai';

  constructor(private readonly settings: ExtensionSettings) {}

  private async requestChatCompletion(body: Record<string, unknown>) {
    const endpoint =
      this.settings.proxyUrl && this.settings.authType === 'proxy' ? this.settings.proxyUrl : this.settings.endpoint;

    if (!isAllowedEndpoint(endpoint)) {
      throw new Error('엔드포인트 URL은 HTTPS(또는 localhost/127.0.0.1의 HTTP)만 허용됩니다.');
    }

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.settings.authType === 'proxy'
          ? {}
          : { Authorization: `Bearer ${this.settings.apiKey}` })
      },
      body: JSON.stringify(body)
    });
  }

  private async requestJson<T>(input: {
    system: string;
    user: string;
    schema: object;
  }): Promise<T> {
    if (!this.settings.apiKey && this.settings.authType !== 'proxy') {
      throw new Error('API 키가 설정되지 않았습니다. 옵션에서 API Key를 저장하세요.');
    }

    const baseBody = {
      model: this.settings.model,
      temperature: this.settings.temperature,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user }
      ]
    };

    let response = await this.requestChatCompletion({
      ...baseBody,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'translation_response',
          schema: input.schema,
          strict: true
        }
      }
    });

    if (!response.ok && response.status < 500) {
      const bodyText = await response.text();
      const isSchemaUnsupported = /response_format|json_schema|unsupported/i.test(bodyText);
      if (!isSchemaUnsupported) {
        throw new Error(`LLM 호출 실패 (${response.status}): ${bodyText.slice(0, 300)}`);
      }

      response = await this.requestChatCompletion(baseBody);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`LLM 호출 실패 (${response.status}): ${bodyText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as ChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('모델 응답이 비어 있습니다.');
    }

    return parseJsonWithRepair<T>(content);
  }

  async prepareContext(input: { article: ArticleContext }): Promise<PreparedContext> {
    if (!this.settings.apiKey) {
      return localFallbackContext(input.article);
    }

    const text = input.article.blocks.map((block) => block.text).join('\n').slice(0, 6000);
    const prompt = buildPreparationPrompt({
      title: input.article.title,
      url: input.article.url,
      headings: input.article.headings,
      text
    });

    try {
      const result = await this.requestJson<{
        summary: string;
        glossary: Array<{ source: string; target: string }>;
      }>({
        system: prompt.system,
        user: prompt.user,
        schema: prompt.schema
      });

      const glossary = result.glossary.reduce<Record<string, string>>((acc, item) => {
        if (!item.source || !item.target) return acc;
        acc[item.source] = item.target;
        return acc;
      }, {});

      return {
        summary: result.summary,
        glossary
      };
    } catch {
      return localFallbackContext(input.article);
    }
  }

  async translateChunk(input: TranslateChunkInput): Promise<TranslationResult[]> {
    const prompt = buildChunkTranslationPrompt({
      url: input.article.url,
      title: input.article.title,
      summary: input.preparedContext.summary,
      glossary: input.preparedContext.glossary,
      neighborContext: input.neighborContext,
      blocks: input.blocks
    });

    const result = await this.requestJson<{ translations: TranslationResult[] }>({
      system: prompt.system,
      user: prompt.user,
      schema: prompt.schema
    });

    return result.translations;
  }
}
