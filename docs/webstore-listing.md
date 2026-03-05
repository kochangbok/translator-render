# Web Store Listing 최종본

아래 문구를 Chrome Web Store 등록 화면에 그대로 붙여 넣으면 됩니다.

## 한국어 (Primary)

### Short description (132자 이내)
영문·중문 웹페이지를 Reader 모드로 재렌더링해 문단 아래 한국어 번역을 삽입하는 LLM 번역 확장.

### Full description
LLM Translator Render는 영문/중문 기사 페이지를 더 읽기 쉽게 한국어로 번역해 주는 Chrome 확장입니다.

핵심 기능
- Reader 모드 재렌더링: 기사 본문을 정리해 안정적인 읽기 화면 제공
- 문단 단위 이중언어 표시: 원문 바로 아래 한국어 번역 삽입
- 문맥 기반 번역: 문서 요약 + 용어집 + 청크 번역으로 용어 일관성 강화
- 인증 방식 선택: API Key / OAuth / Proxy 경로 지원
- 캐시/재시도/요청 큐: 체감 속도 개선 및 실패 내구성 강화
- 민감 도메인 차단: 제외 도메인 설정으로 메일·금융 등 페이지 보호

개인정보 및 보안
- 번역을 위해 페이지 본문 텍스트가 사용자가 설정한 LLM 엔드포인트로 전송될 수 있습니다.
- 설정/캐시는 브라우저 로컬 저장소에 저장됩니다.
- 외부 분석 SDK/광고 SDK를 포함하지 않습니다.
- 콘텐츠 스크립트는 비밀키를 직접 읽지 않으며, background를 통해 요청을 중계합니다.

권한 사용 안내
- storage: 설정, 캐시 저장
- activeTab/scripting: 현재 탭 번역 실행
- identity: OAuth 로그인
- host permissions: 사용자가 지정한 번역 API 호출

## English (Optional secondary)

### Short description
Re-render web articles in Reader mode and insert Korean translation under each paragraph with LLM context.

### Full description
LLM Translator Render helps you read English/Chinese articles in Korean with a stable Reader-mode layout.

Features
- Reader-mode re-rendering for cleaner article layout
- Paragraph-by-paragraph bilingual view (original + Korean)
- Context-aware translation with summary + glossary + chunking
- Multiple auth modes: API key, OAuth, proxy
- Retry queue + cache for resilience and speed
- Excluded-domain safety control for sensitive sites

Privacy note
- Article text may be sent to your configured LLM endpoint for translation.
- No analytics tracker is included.
