| 일자 | 에이전트·발주명 | 오류 | 원인 | 수정 내용 |
|---|---|---|---|---|
| 2026-10-17 | implementer·installsh | verify fail: `sh -n`·`--dry-run` 실행 불가 | fable-gate 가 `install.*` 실행을 fable 설치기 실행으로 보고 차단(메인도 동일) | 검증은 사용자가 `!` 로 실행, 발주에서 install.* 실행 검증을 빼고 정적 검토로 대체 |
| 2026-10-19 | gate-auditor·gatelog | 10-17 `install.*` 차단 재검토 | 규칙 A 는 fable 설치기(`package/installer/` 옆)만 대상 — 리터럴 경로 `sh -n`·`--dry-run` 은 메인 통과(WSL2·0.11.7). 당시 차단은 `$변수`·heredoc 경로로 추정(로그 없음) | lessons·`scripts/CLAUDE.md` 갱신. 서브 실행은 미실측 |
| 2026-10-19 | gate-auditor·gatelog | `shell` 4건(타 레포 claudeOrchestration): deep-reasoner 진행 로그 `echo >>` 가 코드 리다이렉트로 차단 | 규칙 공백 후보 | fable 레포에서 `gate_audit.py log --json` 으로 대상 확인 후 규칙 수정 제안 |
| 2026-10-19 | gate-auditor·gatelog | `self_protect` 1건(타 레포): runner `grep "A\|B"` 가 읽기 허용 문자 밖 | 안내된 제한(오탐 아님) | 발주에서 패턴 검색은 Grep 도구로 |
