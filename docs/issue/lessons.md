# 발주 교훈
- CLI 부수효과를 추측으로 설계했다(marketplace remove 가 플러그인·설정을 지움) → 상태를 바꾸는 claude 명령은 발주 전에 CLAUDE_CONFIG_DIR 격리 실험으로 먼저 확인시킨다
- `install.*` 파일 실행(sh -n·dry-run 포함)은 게이트가 막는다 → 실행 검증은 사용자 `!` 명령으로 돌리고, 발주에는 정적 검토만 넣는다
