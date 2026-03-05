# design.md — LLM 연동 웹페이지 번역 크롬 확장 설계

## 0) 개요

이 확장은 두 가지 표시 모드를 제공한다.

1) **Reader(재렌더링) 모드 (기본)**  
- 페이지에서 기사 본문을 추출(Readability) → 확장 오버레이(또는 새 탭)에서 **새 DOM으로 재렌더링** → 문단별 번역을 원문 아래 삽입

2) **Inline(원페이지 삽입) 모드 (옵션)**  
- 원 페이지 DOM의 문단 요소를 직접 찾아서 번역 DOM을 삽입

요구사항의 “페이지 렌더링을 새로 해야해”를 가장 안정적으로 만족하기 위해 Reader 모드를 MVP의 중심으로 둔다.

---

## 1) 아키텍처(구성요소)

### 1.1 컴포넌트
- **Content Script**
  - 페이지 DOM 접근
  - Readability로 본문 추출(Reader 모드)
  - (Inline 모드 시) 문단 노드 매핑
  - 번역 결과를 DOM에 삽입/업데이트
- **Background Service Worker (MV3)**
  - Provider 호출(LLM API)
  - Auth 토큰/키 관리
  - 요청 큐/재시도/레이트리밋
  - 캐시 관리
- **UI**
  - Popup: ON/OFF, 모드 전환, “이 페이지 번역”
  - Options: Provider 설정(OAuth/키), 모델, 프롬프트 옵션, 스타일

### 1.2 데이터 플로우(Reader 모드)

```
[Page] --(content script: extract)-> ArticleContext + ParagraphBlocks
   -> chrome.runtime.sendMessage({ type:"TRANSLATE", payload })
      -> [background SW: queue + provider call]
         -> { translations: [{id, ko}] }
      <- sendResponse/stream
   -> [content script: render overlay + insert translations]
```

---

## 2) 핵심 데이터 모델

### 2.1 ParagraphBlock
- `id: string` — stable id (index 기반 + 텍스트 해시)
- `text: string` — 원문
- `type: "p" | "li" | "h2" | ...` — 스타일링/청크 규칙
- `meta?: { headingPath?: string }`

### 2.2 ArticleContext
- `url: string`
- `title?: string`
- `siteName?: string`
- `langHint?: "en" | "zh" | "auto"`
- `headings?: string[]`
- `excerpt?: string`
- `blocks: ParagraphBlock[]`

### 2.3 TranslationResult
- `id: string`
- `ko: string`
- `confidence?: number` (선택)
- `flags?: string[]` (예: "UNTRANSLATED_TERMS_DETECTED")

### 2.4 ProviderConfig
- `providerId: "openai" | "anthropic" | "google" | "custom"`
- `authType: "apiKey" | "oauth" | "proxy"`
- `model: string`
- `endpointOverrides?: ...`

---

## 3) 본문 추출/재렌더링 설계

### 3.1 Readability 기반 추출
- 목표: 광고/네비/댓글 제거하고 본문 중심 HTML 확보
- 전략:
  - 문서 clone → Readability parse
  - `article.title`, `article.content`(HTML), `textContent` 활용
  - 실패 시 fallback:
    - `<article>` 태그 우선
    - `main`/`#content`/`.content` 등 휴리스틱
    - 최종 fallback: 사용자가 “이 영역을 본문으로” 지정

### 3.2 Reader 오버레이 렌더러
- 오버레이 컨테이너: `position: fixed; inset: 0; z-index: ...; overflow:auto;`
- 내부에 재렌더링된 본문 DOM을 구성:
  - 제목, 메타(도메인/시간), 본문(블록 반복)
- 각 블록 DOM 구조(예시):

```
<div class="block" data-block-id="...">
  <p class="src">...</p>
  <div class="tr" data-llmtr="1">
    <div class="tr-loading">Translating...</div>
    <div class="tr-text">...</div>
  </div>
</div>
```

- 번역이 도착하면 `.tr-text`를 업데이트하고 로딩 제거.

---

## 4) Inline 삽입 모드 설계(옵션)

### 4.1 대상 노드 선택
- 기본: `p`, `li` 중 “본문 영역”으로 추정되는 컨테이너 내부만
- 본문 컨테이너 추정:
  - Readability 결과의 `content`에서 DOM node 추출 → 원문 DOM의 대응 영역 탐색(어려우면 단순 추정)
  - 또는 heuristics: 가장 많은 텍스트를 가진 컨테이너 찾기

### 4.2 중복/파괴 방지
- 삽입된 노드는 `data-llmtr="1"` 마커 부여
- 원문 노드는 `data-llmtr-src-id="..."`로 매핑
- 재실행 시:
  - 이미 마커가 있으면 스킵
  - 텍스트가 바뀐 경우(동적 로딩)만 갱신

### 4.3 DOM 변화 대응
- MutationObserver로 본문 컨테이너 subtree 감시
- URL 변경(SPA) 감지: `history.pushState` hook 또는 `chrome.webNavigation` 이벤트(가능한 권한 범위 내)
- 변화 감지 시 debounce 후 재추출/재번역

---

## 5) 번역 파이프라인(컨텍스트 이해)

### 5.1 Chunking 전략
- 목적: 문단별 표시를 유지하면서도 컨텍스트를 충분히 줌.
- 기본:
  - 6~12 문단을 1청크로 묶어 번역(길이/토큰 기준)
  - 청크마다 `id` 배열을 유지
- 긴 문서:
  - 1) 전체 문서 요약/글로서리 생성(짧은 콜 1회)
  - 2) 청크 번역 시 요약/글로서리를 함께 제공
  - 3) 청크 간 슬라이딩 윈도우: 이전/다음 1~2 문단을 “참고 문맥”으로 포함(번역 대상은 청크 문단만)

### 5.2 용어 일관성(Glossary/Translation Memory)
- `glossary: Record<string, string>` 형태로 “원문 용어 → 권장 한국어” 테이블을 유지
- 생성 방식(우선순위):
  1) 규칙 기반: 대문자 연속, URL/약어, 한자 고유명사 후보 추출
  2) LLM 기반: 제목+전체 텍스트 일부를 넣고 용어집 생성
- 각 청크 번역 프롬프트에 glossary 포함

### 5.3 구조화 출력(JSON) 강제
- 프롬프트에서 “반드시 JSON 배열로만 출력” 요구
- 스키마(예시):

```json
{
  "translations": [
    { "id": "p3:ab12", "ko": "..." },
    { "id": "p4:cd34", "ko": "..." }
  ]
}
```

- 파싱 실패 시:
  - 1차: JSON 복구 시도(단순 정규화)
  - 2차: “JSON만 다시 출력” 재요청(저비용 모델)

### 5.4 번역 프롬프트(예시)
- 시스템/지시 요약(개략):
  - 역할: 전문 번역가
  - 목표: 자연스러운 한국어 + 원문의 의미/톤 보존
  - 규칙: 문단 id 유지, JSON only, 고유명사/코드/수치 보존
  - 참고: glossary, 문서 요약, 이웃 문맥

---

## 6) Provider/Auth 설계

### 6.1 Provider 추상화
`ProviderAdapter.translate(request): Promise<TranslationResponse>`

- 공통 입력:
  - `ArticleContext`(title/headings/summary/glossary)
  - `Chunk`(blocks[], neighborContext[])
  - `targetLang="ko"`
- 공통 출력:
  - `TranslationResult[]` + usage(토큰/비용 추정 가능하면)

### 6.2 인증 전략(우선순위)
1) **공식 OAuth가 제공되는 Provider**  
   - chrome.identity / launchWebAuthFlow 기반 구현 가능
2) **공식 API 키 기반 Provider**  
   - Options에 키 저장(사용자 로컬)
3) **사용자 개인 프록시(선택)**  
   - 키를 확장에 저장하지 않기 위해, 사용자가 소유한 서버(Cloudflare Worker 등)에 저장
   - 확장은 프록시에만 호출

> 주의: 소비자용 챗 UI 구독을 “비공식 토큰/쿠키”로 우회 호출하는 방식은 정책/약관 리스크가 커서 설계에서 제외.

### 6.3 토큰/키 저장
- `chrome.storage.sync`(권장 X: 동기화로 유출면적 증가) vs `chrome.storage.local`(권장)
- 민감 정보(키/리프레시 토큰)는 가능하면:
  - 최소 권한
  - (가능 시) OS keychain/Native messaging(고급) 또는 프록시 사용

---

## 7) 캐시 설계

### 7.1 키
- `cacheKey = hash(url + block.id + block.text)`
- 결과: `TranslationResult.ko`

### 7.2 정책
- LRU(예: 최대 50MB 또는 50,000 문단)
- TTL(선택): 30일
- 문단 텍스트가 바뀌면 해시가 바뀌므로 자동 무효화

---

## 8) 오류 처리/관측성

- 네트워크 오류: 문단별 재시도(지수 백오프)
- 429/레이트리밋: 큐에서 지연 처리 + 사용자에게 “잠시 후 자동 재개” 표시
- 파싱 오류: JSON-only 재요청
- 언어 판별 불명확: 사용자 선택(“이 페이지 원문 언어: EN/ZH/자동”)

로그:
- 개발 모드에서만 verbose
- 사용자 모드에서는 최소(PII/본문 로그 금지)

---

## 9) 테스트 전략(채점 가능 형태)

### 9.1 고정 샘플 URL 세트
- `docs/qa-sample-urls.md`에 10개 고정
- 각 URL에 대해:
  - 추출 성공 여부
  - 블록 수
  - 첫 5블록 번역 표시 시간
  - 용어 일관성 체크(수동)

### 9.2 자동 테스트(가능 범위)
- Readability 추출 유닛 테스트(HTML fixture)
- Chunking/ID 안정성 테스트
- Prompt 출력 파서 테스트(JSON robustness)

### 9.3 수동 회귀 체크리스트
- [ ] 번역 토글/복귀
- [ ] 스크롤 중 로딩/삽입 안정
- [ ] 새로고침 후 캐시 적용
- [ ] 옵션 변경(모델/스타일) 반영

---

## 10) 추천 파일 구조(예시)

```
src/
  background/
    index.ts            # queue, provider, cache, messaging
    providers/
      openai.ts
      google.ts
      custom.ts
    cache/
      storage.ts
      lru.ts
  content/
    index.ts            # entry
    reader/
      extract.ts        # Readability wrapper
      render.ts         # overlay renderer
    inline/
      mapParagraphs.ts
      inject.ts
    dom/
      observe.ts
      styles.css
  ui/
    popup/
      index.html
      popup.ts
    options/
      index.html
      options.ts
  shared/
    types.ts
    hash.ts
    prompt.ts
```

---

## 11) 보안/프라이버시 원칙
- 본문 텍스트를 LLM으로 전송하는 것이 핵심 기능이므로, Options에 명확히 고지(로컬/원격 전송).
- “민감 사이트 제외 목록” 기능(옵션): 예) 은행/메일/사내 도메인에서는 자동 비활성화.
- 최소 권한(host_permissions를 과도하게 `all_urls`로 두지 않도록 단계적으로 권한 요청).

