# translator-render

LLM 기반 웹페이지 번역 크롬 확장(MV3)입니다.

## 빠른 시작

```bash
npm install
npm run build
```

1. Chrome에서 `chrome://extensions` 이동
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램을 로드" -> `dist/` 선택

## 구현 범위(MVP)
- Reader 모드(재렌더링) 기본
- 문단 단위 원문+한국어 번역 표시
- OpenAI API Key Provider
- 캐시/재시도/기본 큐

## 설정
- 확장 Options에서 API Key, 모델, 엔드포인트, 모드 설정
- OAuth/Proxy는 구조 제공(Provider 확장 가능)
