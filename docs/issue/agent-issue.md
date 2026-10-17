| 일자 | 에이전트·발주명 | 오류 | 원인 | 수정 내용 |
|---|---|---|---|---|
| 2026-10-17 | implementer·installsh | verify fail: `sh -n`·`--dry-run` 실행 불가 | fable-gate 가 `install.*` 실행을 fable 설치기 실행으로 보고 차단(메인도 동일) | 검증은 사용자가 `!` 로 실행, 발주에서 install.* 실행 검증을 빼고 정적 검토로 대체 |
