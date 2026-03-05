import { DEFAULT_SETTINGS } from '@/shared/defaults';
import { loadSettings } from '@/shared/storage';
import type { ExtensionSettings, OAuthTokenState, RuntimeResponse } from '@/shared/types';

interface FormElements {
  providerId: HTMLSelectElement;
  authType: HTMLSelectElement;
  apiKey: HTMLInputElement;
  model: HTMLInputElement;
  endpoint: HTMLInputElement;
  proxyUrl: HTMLInputElement;
  oauthAuthUrl: HTMLInputElement;
  oauthTokenUrl: HTMLInputElement;
  oauthClientId: HTMLInputElement;
  oauthClientSecret: HTMLInputElement;
  oauthScope: HTMLInputElement;
  oauthAudience: HTMLInputElement;
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
    oauthAuthUrl: document.getElementById('oauthAuthUrl') as HTMLInputElement,
    oauthTokenUrl: document.getElementById('oauthTokenUrl') as HTMLInputElement,
    oauthClientId: document.getElementById('oauthClientId') as HTMLInputElement,
    oauthClientSecret: document.getElementById('oauthClientSecret') as HTMLInputElement,
    oauthScope: document.getElementById('oauthScope') as HTMLInputElement,
    oauthAudience: document.getElementById('oauthAudience') as HTMLInputElement,
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

function setOAuthStatus(state: OAuthTokenState | null): void {
  const target = document.getElementById('oauthStatus');
  if (!target) return;

  if (!state) {
    target.textContent = 'OAuth 상태를 확인하지 못했습니다.';
    return;
  }

  if (!state.connected) {
    target.textContent = 'OAuth 미연결';
    return;
  }

  const expiry = state.expiresAt ? new Date(state.expiresAt).toLocaleString() : '만료 없음';
  target.textContent = `OAuth 연결됨 / refresh_token=${state.hasRefreshToken ? '있음' : '없음'} / 만료=${expiry}`;
}

function updateAuthVisibility(): void {
  const form = getFormElements();
  const isApiKey = form.authType.value === 'apiKey';
  const isOAuth = form.authType.value === 'oauth';
  const isProxy = form.authType.value === 'proxy';

  form.apiKey.disabled = !isApiKey;
  form.endpoint.disabled = isProxy;
  form.proxyUrl.disabled = !isProxy;

  form.oauthAuthUrl.disabled = !isOAuth;
  form.oauthTokenUrl.disabled = !isOAuth;
  form.oauthClientId.disabled = !isOAuth;
  form.oauthClientSecret.disabled = !isOAuth;
  form.oauthScope.disabled = !isOAuth;
  form.oauthAudience.disabled = !isOAuth;
}

function fillForm(values: ExtensionSettings): void {
  const form = getFormElements();
  form.providerId.value = values.providerId;
  form.authType.value = values.authType;
  form.apiKey.value = values.apiKey;
  form.model.value = values.model;
  form.endpoint.value = values.endpoint;
  form.proxyUrl.value = values.proxyUrl;
  form.oauthAuthUrl.value = values.oauthAuthUrl;
  form.oauthTokenUrl.value = values.oauthTokenUrl;
  form.oauthClientId.value = values.oauthClientId;
  form.oauthClientSecret.value = values.oauthClientSecret;
  form.oauthScope.value = values.oauthScope;
  form.oauthAudience.value = values.oauthAudience;
  form.mode.value = values.mode;
  form.chunkSize.value = String(values.chunkSize);
  updateAuthVisibility();
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
    oauthAuthUrl: form.oauthAuthUrl.value.trim(),
    oauthTokenUrl: form.oauthTokenUrl.value.trim(),
    oauthClientId: form.oauthClientId.value.trim(),
    oauthClientSecret: form.oauthClientSecret.value.trim(),
    oauthScope: form.oauthScope.value.trim(),
    oauthAudience: form.oauthAudience.value.trim(),
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

async function refreshOAuthStatus(): Promise<void> {
  try {
    const state = await sendMessage<OAuthTokenState>({ type: 'OAUTH_STATUS' });
    setOAuthStatus(state);
  } catch {
    setOAuthStatus(null);
  }
}

async function initialize(): Promise<void> {
  const current = await loadSettings();
  fillForm(current);
  await refreshOAuthStatus();
}

document.getElementById('authType')?.addEventListener('change', () => {
  updateAuthVisibility();
});

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
    await refreshOAuthStatus();
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

document.getElementById('oauthLogin')?.addEventListener('click', async () => {
  setStatus('OAuth 로그인 중...');

  try {
    await sendMessage<ExtensionSettings>({
      type: 'SAVE_SETTINGS',
      payload: readForm()
    });

    const state = await sendMessage<OAuthTokenState>({ type: 'OAUTH_LOGIN' });
    setStatus('OAuth 로그인 성공');
    setOAuthStatus(state);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'OAuth 로그인 실패', true);
  }
});

document.getElementById('oauthLogout')?.addEventListener('click', async () => {
  setStatus('OAuth 로그아웃 중...');

  try {
    await sendMessage<{ disconnected: boolean }>({ type: 'OAUTH_LOGOUT' });
    setStatus('OAuth 로그아웃 완료');
    await refreshOAuthStatus();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'OAuth 로그아웃 실패', true);
  }
});

document.getElementById('oauthRefresh')?.addEventListener('click', async () => {
  await refreshOAuthStatus();
  setStatus('OAuth 상태를 갱신했습니다.');
});

initialize().catch((error) => {
  setStatus(error instanceof Error ? error.message : '설정 로드 실패', true);
});
