import { OAUTH_TOKEN_STORAGE_KEY } from '@/shared/defaults';
import type { ExtensionSettings, OAuthTokenState, ProviderId } from '@/shared/types';

interface StoredOAuthToken {
  providerId: ProviderId;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
  updatedAt: number;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

function assertOAuthConfig(settings: ExtensionSettings): void {
  if (!settings.oauthAuthUrl || !settings.oauthTokenUrl || !settings.oauthClientId) {
    throw new Error('OAuth 설정이 부족합니다. Auth URL / Token URL / Client ID를 확인하세요.');
  }
}

function randomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((v) => chars[v % chars.length])
    .join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

async function readStoredToken(): Promise<StoredOAuthToken | null> {
  const data = await chrome.storage.local.get(OAUTH_TOKEN_STORAGE_KEY);
  return (data[OAUTH_TOKEN_STORAGE_KEY] as StoredOAuthToken | undefined) ?? null;
}

async function writeStoredToken(token: StoredOAuthToken): Promise<void> {
  await chrome.storage.local.set({
    [OAUTH_TOKEN_STORAGE_KEY]: token
  });
}

export async function clearOAuthToken(): Promise<void> {
  await chrome.storage.local.remove(OAUTH_TOKEN_STORAGE_KEY);
}

function parseTokenPayload(payload: OAuthTokenResponse, providerId: ProviderId): StoredOAuthToken {
  if (!payload.access_token) {
    throw new Error('OAuth 토큰 응답에 access_token이 없습니다.');
  }

  const expiresAt = payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined;

  return {
    providerId,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    expiresAt,
    updatedAt: Date.now()
  };
}

function readOAuthCallbackParams(callbackUrl: string): URLSearchParams {
  const url = new URL(callbackUrl);

  if (url.searchParams.get('code') || url.searchParams.get('error')) {
    return url.searchParams;
  }

  if (url.hash.startsWith('#')) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    if (hashParams.get('access_token') || hashParams.get('error')) {
      return hashParams;
    }
  }

  return url.searchParams;
}

async function exchangeAuthorizationCode(
  settings: ExtensionSettings,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<StoredOAuthToken> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: settings.oauthClientId,
    code_verifier: codeVerifier
  });

  if (settings.oauthClientSecret) {
    params.set('client_secret', settings.oauthClientSecret);
  }

  const response = await fetch(settings.oauthTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth 토큰 교환 실패 (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = (await response.json()) as OAuthTokenResponse;
  return parseTokenPayload(payload, settings.providerId);
}

async function refreshAccessToken(settings: ExtensionSettings, stored: StoredOAuthToken): Promise<StoredOAuthToken | null> {
  if (!stored.refreshToken) return null;
  if (!settings.oauthTokenUrl || !settings.oauthClientId) return null;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: stored.refreshToken,
    client_id: settings.oauthClientId
  });

  if (settings.oauthClientSecret) {
    params.set('client_secret', settings.oauthClientSecret);
  }

  const response = await fetch(settings.oauthTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OAuthTokenResponse;
  const refreshed = parseTokenPayload(payload, settings.providerId);

  if (!refreshed.refreshToken) {
    refreshed.refreshToken = stored.refreshToken;
  }

  await writeStoredToken(refreshed);
  return refreshed;
}

export async function startOAuthLogin(settings: ExtensionSettings): Promise<OAuthTokenState> {
  assertOAuthConfig(settings);

  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const state = randomString(24);
  const codeVerifier = randomString(64);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  const authUrl = new URL(settings.oauthAuthUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', settings.oauthClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  if (settings.oauthScope) {
    authUrl.searchParams.set('scope', settings.oauthScope);
  }

  if (settings.oauthAudience) {
    authUrl.searchParams.set('audience', settings.oauthAudience);
  }

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  if (!callbackUrl) {
    throw new Error('OAuth 콜백 URL을 받지 못했습니다.');
  }

  const params = readOAuthCallbackParams(callbackUrl);

  const error = params.get('error');
  if (error) {
    const description = params.get('error_description');
    throw new Error(`OAuth 로그인 실패: ${error}${description ? ` (${description})` : ''}`);
  }

  const returnedState = params.get('state');
  if (returnedState && returnedState !== state) {
    throw new Error('OAuth state 검증에 실패했습니다.');
  }

  const accessToken = params.get('access_token');
  let stored: StoredOAuthToken;

  if (accessToken) {
    stored = parseTokenPayload(
      {
        access_token: accessToken,
        token_type: params.get('token_type') ?? undefined,
        expires_in: params.get('expires_in') ? Number(params.get('expires_in')) : undefined
      },
      settings.providerId
    );
  } else {
    const code = params.get('code');
    if (!code) {
      throw new Error('OAuth authorization code를 찾지 못했습니다.');
    }
    stored = await exchangeAuthorizationCode(settings, code, redirectUri, codeVerifier);
  }

  await writeStoredToken(stored);

  return {
    connected: true,
    hasRefreshToken: Boolean(stored.refreshToken),
    expiresAt: stored.expiresAt
  };
}

export async function getOAuthTokenState(settings: ExtensionSettings): Promise<OAuthTokenState> {
  const stored = await readStoredToken();
  if (!stored || stored.providerId !== settings.providerId) {
    return {
      connected: false,
      hasRefreshToken: false
    };
  }

  const isExpired = Boolean(stored.expiresAt && stored.expiresAt <= Date.now());
  if (isExpired) {
    const refreshed = await refreshAccessToken(settings, stored);
    if (!refreshed) {
      return {
        connected: false,
        hasRefreshToken: false
      };
    }

    return {
      connected: true,
      hasRefreshToken: Boolean(refreshed.refreshToken),
      expiresAt: refreshed.expiresAt
    };
  }

  return {
    connected: true,
    hasRefreshToken: Boolean(stored.refreshToken),
    expiresAt: stored.expiresAt
  };
}

export async function getOAuthAccessToken(settings: ExtensionSettings): Promise<string | null> {
  const stored = await readStoredToken();
  if (!stored || stored.providerId !== settings.providerId) {
    return null;
  }

  const willExpireSoon = Boolean(stored.expiresAt && stored.expiresAt <= Date.now() + 60_000);
  if (willExpireSoon) {
    const refreshed = await refreshAccessToken(settings, stored);
    if (refreshed?.accessToken) {
      return refreshed.accessToken;
    }
  }

  if (stored.expiresAt && stored.expiresAt <= Date.now()) {
    return null;
  }

  return stored.accessToken;
}
