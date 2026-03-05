# Extension Usage Guide

## Quick smoke test
1. 확장을 `dist/`로 로드
2. Options에서 API Key 또는 OAuth 설정 저장
3. OAuth 사용 시 `OAuth 로그인` 완료 후 상태 확인
4. `연결 테스트` 성공 확인
5. 영어 뉴스 기사 페이지에서 `이 페이지 번역`
6. Reader 오버레이에 문단별 번역 표시 확인

## Troubleshooting
- **API 키 오류**: Options에서 새 키 저장 후 재시도
- **요청 제한(429)**: 잠시 대기 후 재시도
- **본문 추출 실패**: Inline 모드로 변경 후 재시도
- **브라우저 내부 페이지(chrome://)**: 보안 정책상 동작하지 않음
