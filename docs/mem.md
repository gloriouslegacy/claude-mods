# 세션 메모 (갱신 2026-10-19 · 커밋 d784466 · v1.4.0 기준)
## 끝낸 것 (최근)
- v1.4.0 게시(태그 v1.4.0, release zip+SHA256SUMS): agent-flow 0.6.0 `autoOpen`(기본 true, 프로세스 첫 session.start 1회, 못 그리면 토스트). 명세 docs/spec/v1.4.0.md
  - reviewer 충족·security 높음 없음, CI 4잡·release 통과, 게이트 시나리오 423 PASS / 0 FAIL / 4 SKIP
- runner "Haiku 4.5" 표시: agent-flow 버그 아님. `~/.claude/agents/.bak-map/runner.md`(haiku-4-5) 가 이름 충돌로 정식 정의를 덮음 → 다른 세션이 `~/.claude/fable/bak-agents-20261018/` 로 옮겨 해결
## 열린 것
- 실측 필요: 업데이트 후 compact·resume 뒤 pane 이 다시 안 열리는지, `-p` 에서 토스트 표시. 다시 열리면 1회 판정을 atom/store 로 옮길지 검토
- 미검증: macOS 실설치, 서브에이전트의 install.sh 실행 / WSL 에 pwsh 없음
- 낮음 보류: sh 상대경로 CLAUDE_CONFIG_DIR, sh 머리 주석 em dash, ps1 `-Dir` 링크, `autoOpen` 문자열 "false" 를 켜짐으로 봄(`log` 와 같은 패턴), 기존 `gating hook without .catch` 경고(agent-flow tool.call 등)
## 다음에
- 새 기능명세는 fable 0.11.7 양식(`영향:`·`예외:`·전제)으로
- Windows 에서 Git Bash 로 install.sh 실제 실행 금지
- agent 정의 중복(하위 폴더·프로젝트 `.claude/agents/`) 점검은 fable 쪽 개선 후보 — 이 레포 일 아님
