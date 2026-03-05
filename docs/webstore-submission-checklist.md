# Web Store 제출 체크리스트 (최종)

## A. 텍스트/정책
- [ ] `docs/webstore-listing.md`에서 Short/Full description 복사
- [ ] `docs/privacy-policy.md`를 공개 URL로 배포 후 등록
- [ ] 카테고리 Productivity 설정

## B. 이미지/아이콘
- [ ] 아이콘 128x128 등록 (`public/icons/icon-128.png`)
- [ ] 스크린샷 3~5장 업로드
- [ ] 캡션은 `docs/webstore-screenshot-captions.md` 사용

## C. 패키지
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run pack`
- [ ] `translator-render-extension.zip` 업로드

## D. 권한 설명
- [ ] storage: 설정/캐시 저장
- [ ] activeTab/scripting: 현재 탭 번역
- [ ] identity: OAuth 로그인
- [ ] host permissions: 번역 API 호출

## E. 출시 후
- [ ] 공개 스토어 페이지 확인
- [ ] 설치 후 Reader 모드 동작 확인
- [ ] API Key/OAuth 각각 연결 테스트
