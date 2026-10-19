# 세션 메모 (갱신 2026-10-19 · 커밋 1d50e30 + 미커밋 v1.4.0 기준)
## 끝낸 것 (최근)
- v1.3.0 게시, WSL2 이전 점검·fable 0.11.7 검토(d41a2f0·1d50e30)
- v1.4.0 작업(미커밋): agent-flow 0.6.0 `autoOpen`(기본 true, 프로세스 첫 session.start 1회, 못 그리면 토스트). 명세 docs/spec/v1.4.0.md
  - reviewer 충족·security 높음 없음, 토스트 try 보강 후 `check.sh` 전체 통과(17 tests). README 2·CHANGELOG·VERSION·agent-flow/CLAUDE.md 갱신
## 열린 것
- v1.4.0 커밋·push·태그는 사용자 승인 대기
- 실측 필요: compact·resume 뒤 pane 이 다시 안 열리는지, `-p` 에서 토스트. 실제 Claude Code 로 확인
- agent-flow pane 에 runner 가 `Haiku 4.5` 로 표시(정의는 claude-haiku-5-5) — model.ts 매핑 또는 실제 모델 확인 필요
- 미검증: macOS 실설치, 서브에이전트의 install.sh 실행 / WSL 에 pwsh 없음
- 낮음 보류: sh 상대경로 CLAUDE_CONFIG_DIR, sh 머리 주석 em dash, ps1 `-Dir` 링크, `autoOpen` 문자열 "false" 를 켜짐으로 봄(`log` 와 같은 패턴)
## 다음에
- 새 기능명세는 fable 0.11.7 양식(`영향:`·`예외:`·전제)으로
- Windows 에서 Git Bash 로 install.sh 실제 실행 금지
