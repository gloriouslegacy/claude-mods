# 세션 메모 (갱신 2026-10-19 · 커밋 d41a2f0 · v1.3.0 기준)
## 끝낸 것 (최근)
- v1.3.0 게시(설치기 진입+lib 분할, 기본 위치 `${CLAUDE_CONFIG_DIR:-~/.claude}/claude-mods`). 명세 docs/spec/v1.3.0.md
- 개발 환경 WSL2(Ubuntu, zsh)로 이전 — `check.sh` 전부 통과, WSL·Windows 양쪽 `~/.claude/claude-mods/current` 에 v1.3.0, 옛 `%LOCALAPPDATA%` 폴더 없음
- fable 0.11.7 검토: 이 레포 `install.*` 는 규칙 A 대상 아님(리터럴 경로 `sh -n`·dry-run 메인 통과) → lessons·`scripts/CLAUDE.md` 갱신
- WSL 에 shellcheck 0.8.0 설치, CI 옵션(`--shell=sh --severity=warning`)으로 install·lib 통과
## 열린 것
- 미검증: macOS 실설치, 서브에이전트의 install.sh 실행. RELEASE.md 4.2(PR·check 필수)는 직접 push 방식과 다름
- WSL 에 pwsh 없음 — ps1 lint·실행 검증은 CI·Windows 쪽
- 낮음 보류: sh 상대경로 CLAUDE_CONFIG_DIR 미절대화, sh 머리 주석 em dash, ps1 `-Dir` 링크 미해석(문서화됨)
## 다음에
- 새 기능명세는 fable 0.11.7 양식(`영향:`·실패 지도 `예외:`·전제·축소 질문)으로
- Windows 에서 Git Bash 로 install.sh 실제 실행 금지(marketplace 가 `/c/...` 경로로 등록될 수 있음) — 필요하면 README 에 한 줄
