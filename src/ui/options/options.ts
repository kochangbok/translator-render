import { DEFAULT_SETTINGS } from '@/shared/defaults';
import { loadSettings } from '@/shared/storage';
import type { ExtensionSettings, RuntimeResponse } from '@/shared/types';

interface FormElements {
  providerId: HTMLSelectElement;
  authType: HTMLSelectElement;
  apiKey: HTMLInputElement;
  model: HTMLInputElement;
  endpoint: HTMLInputElement;
  proxyUrl: HTMLInputElement;
  mode: HTMLSelectElement;
  chunkSize: HTMLInputElement;
}

function getFormElements(): FormElements {
  return {
    providerId: document.getElementById('providerId') as HTMLSelectElement,
    authType: document.getElementById('authType') as HTMLSelectElement,
    apiKey: document.getElementById('apiKey') as HTMLInputElement,
    model: document.getElementById('model') as HTMLInputElement,
    endpoint: document.getElementById('endpoint') as HTMLInputElement,
    proxyUrl: document.getElementById('proxyUrl') as HTMLInputElement,
    mode: document.getElementById('mode') as HTMLSelectElement,
    chunkSize: document.getElementById('chunkSize') as HTMLInputElement
  };
}

function setStatus(text: string, isError = false): void {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = text;
  status.style.color = isError ? '#cf222e' : '#0969da';
}

function fillForm(values: ExtensionSettings): void {
  const form = getFormElements();
  form.providerId.value = values.providerId;
  form.authType.value = values.authType;
  form.apiKey.value = values.apiKey;
  form.model.value = values.model;
  form.endpoint.value = values.endpoint;
  form.proxyUrl.value = values.proxyUrl;
  form.mode.value = values.mode;
  form.chunkSize.value = String(values.chunkSize);
}

function readForm(): Partial<ExtensionSettings> {
  const form = getFormElements();
  const chunkSize = Number(form.chunkSize.value || DEFAULT_SETTINGS.chunkSize);

  return {
    providerId: form.providerId.value as ExtensionSettings['providerId'],
    authType: form.authType.value as ExtensionSettings['authType'],
    apiKey: form.apiKey.value.trim(),
    model: form.model.value.trim() || DEFAULT_SETTINGS.model,
    endpoint: form.endpoint.value.trim() || DEFAULT_SETTINGS.endpoint,
    proxyUrl: form.proxyUrl.value.trim(),
    mode: form.mode.value as ExtensionSettings['mode'],
    chunkSize: Number.isFinite(chunkSize) ? Math.max(2, Math.min(20, chunkSize)) : DEFAULT_SETTINGS.chunkSize
  };
}

async function sendMessage<T>(message: { type: string; payload?: unknown }): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

async function initialize(): Promise<void> {
  const current = await loadSettings();
  fillForm(current);
}

document.getElementById('settingsForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('저장 중...');

  try {
    const saved = await sendMessage<ExtensionSettings>({
      type: 'SAVE_SETTINGS',
      payload: readForm()
    });

    fillForm(saved);
    setStatus('저장되었습니다.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '저장 실패', true);
  }
});

document.getElementById('clearCache')?.addEventListener('click', async () => {
  setStatus('캐시 삭제 중...');
  try {
    await sendMessage<{ cleared: boolean }>({ type: 'CLEAR_CACHE' });
    setStatus('캐시를 삭제했습니다.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '실패', true);
  }
});

document.getElementById('testConnection')?.addEventListener('click', async () => {
  setStatus('연결 테스트 중...');

  try {
    const result = await sendMessage<{ provider: string; model: string; sample: string }>({
      type: 'TEST_PROVIDER'
    });

    const sample = result.sample ? ` / 샘플: ${result.sample}` : '';
    setStatus(`연결 성공 (${result.provider}, ${result.model})${sample}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '연결 테스트 실패', true);
  }
});

initialize().catch((error) => {
  setStatus(error instanceof Error ? error.message : '설정 로드 실패', true);
});
