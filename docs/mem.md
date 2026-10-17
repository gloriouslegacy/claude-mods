# 세션 메모 (갱신 2026-10-17 · 커밋 3d0f3be · v1.3.0 기준)
## 끝낸 것 (최근)
- v1.3.0 게시(CI·release 통과, zip 루트에 설치기 4파일): agent-flow 0.5.0 옛 `/agent-flow` 제거, 설치기 진입+lib 분할, 기본 위치 `${CLAUDE_CONFIG_DIR:-~/.claude}/claude-mods`. 명세 docs/spec/v1.3.0.md
- 설치기 검증: 사용자 `!` 로 PSScriptAnalyzer 0건·pwsh 7/PS 5.1·sh dry-run·거부 검사, CI 에서 shellcheck 통과
## 열린 것
- 이 PC 는 아직 옛 위치(`%LOCALAPPDATA%\claude-mods`)에 v1.2.0 설치 — ps1 로 v1.3.0 설치 후 옛 폴더 수동 삭제
- 미검증: Linux/macOS 실설치. RELEASE.md 4.2(PR·check 필수)는 직접 push 방식과 다름
- 낮음 보류: sh 상대경로 CLAUDE_CONFIG_DIR 미절대화, sh 머리 주석 em dash, ps1 `-Dir` 링크 미해석(문서화됨)
## 다음에
- Windows 에서 Git Bash 로 install.sh 실제 실행 금지(marketplace 가 `/c/...` 경로로 등록될 수 있음) — 필요하면 README 에 한 줄
