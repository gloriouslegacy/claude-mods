# 세션 메모 (갱신 2026-10-17 · 커밋 fda9acb 기준, 설치 스크립트 커밋 직전)
## 끝낸 것 (최근)
- 중복 검사 → 복사본 4쌍(check.sh), README·baseline·structure 모순 정리
- scripts/install.sh·install.ps1 작성, reviewer 2회 + 격리 실험 반영(marketplace 이동은 remove 없이 add)
- ps1 -DryRun(pwsh 7.6.7) 정상 확인. README·RELEASE.md 설치 안내 갱신
## 열린 것
- install.sh 실행 검증 없음(게이트 차단, 사용자 PC 미실행) → push 후 CI scripts 잡(shellcheck·dry-run)으로 확인
- install.sh 실행 권한: 사용자가 `git update-index --chmod=+x scripts/install.sh` 필요(게이트 차단)
- 미검증: 버전 상승 update 후 설정 유지, PS 5.1 dry-run·리다이렉트 Authorization, Linux/macOS 경로 비교
- 두 설치기 500줄 직전(sh 492·ps1 498) — 기능 추가 전 분할 필요
## 다음에
- push → CI 확인 → v1.1.0-rc.1 태그로 release 워크플로 점검 → 실제 설치(이 PC: my-mods 경로 이동, tcw→qhud)
- v1.2.0 에서 qhud /tcw-usage 제거
