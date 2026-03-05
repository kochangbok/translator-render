# translator-render

LLM 기반 웹페이지 번역 크롬 확장(MV3)입니다.

## 기능
- Reader 모드(재렌더링) 기본
- 문단 단위 원문 + 한국어 번역 삽입
- Inline 모드(원페이지 삽입) 기본 지원 + DOM 변화 감지 재실행
- OpenAI API Key Provider
- 캐시/재시도/요청 큐
- 단축키 토글: `Ctrl+Shift+Y` (`⌘+Shift+Y` on macOS)

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
2. Provider: `OpenAI`
3. Auth Type: `API Key`
4. API Key / Model 입력 후 저장
5. (선택) `연결 테스트` 버튼으로 확인

## 사용법
1. 번역할 기사 페이지에서 확장 아이콘 클릭
2. `이 페이지 번역` 클릭 (또는 단축키)
3. 종료는 `끄기` 클릭 (또는 단축키 다시 입력)

## 패키징(zip)

```bash
npm run pack
```

산출물: `translator-render-extension.zip`

## 참고
- OAuth/Proxy 경로는 구조를 마련해두었고, MVP 기본 경로는 API Key입니다.
- 본문 텍스트는 번역을 위해 외부 LLM API로 전송됩니다.
