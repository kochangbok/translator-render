# translator-render

LLM 기반 웹페이지 번역 크롬 확장(MV3)입니다.

## 기능
- Reader 모드(재렌더링) 기본
- 문단 단위 원문 + 한국어 번역 삽입
- Inline 모드(원페이지 삽입) 기본 지원 + DOM 변화 감지 재실행
- OpenAI API Key Provider
- OAuth 로그인(`chrome.identity.launchWebAuthFlow`) 기반 토큰 인증 경로
- 캐시/재시도/요청 큐
- 단축키 토글: `Ctrl+Shift+Y` (`⌘+Shift+Y` on macOS)
- 제외 도메인 설정(메일/금융 등 민감 도메인 번역 차단)

## 로컬 빌드

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Chrome에 로드
1. `chrome://extensions` 열기
2. 우측 상단 개발자 모드 ON
3. "압축해제된 확장 프로그램을 로드" 클릭
4. 프로젝트의 `dist/` 디렉토리 선택

## 초기 설정
1. 확장 아이콘 클릭 → `설정 열기`
2. Provider 선택 후 Auth Type 선택
3. API Key 모드: API Key / Model 저장
4. OAuth 모드: OAuth URL/Client 정보 저장 후 `OAuth 로그인`
5. `연결 테스트` 버튼으로 확인
6. 필요 시 제외 도메인 목록을 추가해 민감 페이지 번역을 차단

## 사용법
1. 번역할 기사 페이지에서 확장 아이콘 클릭
2. `이 페이지 번역` 클릭 (또는 단축키)
3. 종료는 `끄기` 클릭 (또는 단축키 다시 입력)

## 패키징(zip)

```bash
npm run pack
```

산출물: `translator-render-extension.zip`

## Chrome Web Store 준비
- 절차: `docs/chrome-web-store.md`
- 스토어 설명 최종본: `docs/webstore-listing.md`
- 스크린샷 캡션 최종본: `docs/webstore-screenshot-captions.md`
- 제출 체크리스트: `docs/webstore-submission-checklist.md`
- 개인정보처리방침: `docs/privacy-policy.md`
- 공개 Privacy URL: `https://kochangbok.github.io/translator-render/privacy-policy/`

## 참고
- OAuth/Proxy/API Key 모두 지원합니다. 단, Provider가 OAuth를 공식 지원해야 로그인 성공합니다.
- 본문 텍스트는 번역을 위해 외부 LLM API로 전송됩니다.
- 보안 강화를 위해 콘텐츠 스크립트는 비밀키/토큰을 직접 읽지 않고 background를 통해 번역 요청만 수행합니다.
