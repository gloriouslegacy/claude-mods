# 세션 메모 (갱신 2026-10-17 · 커밋 f149815 기준)
## 끝낸 것 (최근)
- V5 적용: 루트·모듈 5개 CLAUDE.md, docs/design/baseline.md, docs/structure.md, docs 하위 폴더 이행
- check.sh 복사본 3쌍 검사 추가, release.yml(설치기 없으면 경고, docs/migration 포함)
- docs/release/RELEASE.md 검토 18건 반영(사실 수정 + 사용자 결정 3개)
## 열린 것
- 설치 스크립트(install.sh/ps1)·bump-version.mjs 미작성 — 사양은 RELEASE.md 5·6장
- 검증 필요: CI 에서 claude plugin test 로그인 필요 여부, 로컬 marketplace 캐시 복사 여부, $.store 실제 경로
- check.sh validate 가 "passed with warnings" — 경고 내용 미확인, claude plugin test 로컬 미실행
## 다음에
- 첫 태그 v1.1.0-rc.1 로 release 워크플로 점검 → v1.1.0
- v1.2.0 에서 qhud /tcw-usage 제거
