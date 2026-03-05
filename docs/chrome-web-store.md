# Chrome Web Store 배포 절차

## 1) 사전 점검
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run pack`
- [ ] `translator-render-extension.zip` 생성 확인
- [ ] README / privacy-policy 최신화

## 2) 개발자 대시보드
1. https://chrome.google.com/webstore/devconsole 접속
2. 신규 아이템 생성
3. `translator-render-extension.zip` 업로드

## 3) 스토어 입력 항목
- 카테고리: Productivity
- 언어: Korean / English
- 간단/상세 설명: `docs/webstore-listing.md` 최종본 사용
- 아이콘: `public/icons/icon-128.png`
- 스크린샷: 최소 1장(권장 3~5장, `docs/webstore-screenshot-captions.md` 사용)
- 개인정보처리방침 URL:
  - `https://kochangbok.github.io/translator-render/privacy-policy/`

## 4) 권한 설명 포인트
- `storage`: 설정, 캐시 저장
- `activeTab`, `scripting`: 현재 페이지 번역 실행
- `identity`: OAuth 로그인
- host permissions: LLM API 호출(HTTPS) 및 로컬 개발 서버

## 5) 출시 후 체크
- [ ] 실제 기사 페이지 번역 동작 확인
- [ ] OAuth 로그인/로그아웃 확인
- [ ] 제외 도메인 동작 확인
- [ ] 에러 메시지/재시도 동작 확인
