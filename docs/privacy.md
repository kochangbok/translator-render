# Privacy

- 본문 텍스트는 번역을 위해 설정된 LLM Provider로 전송될 수 있습니다.
- API 키는 `chrome.storage.local`에 저장됩니다.
- OAuth 사용 시 access token/refresh token은 `chrome.storage.local`에 저장되고, 만료 시 refresh를 시도합니다.
- 민감 사이트에서는 확장 사용을 피하세요(향후 예외 도메인 기능 예정).
