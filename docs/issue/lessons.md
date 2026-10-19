# 발주 교훈
- 설치기 검증 명령에 `$변수`·heredoc 속 경로를 쓰면 게이트가 보수적으로 막는다 → 발주에 `install.*` 는 리터럴 경로로(`sh -n scripts/install.sh`·`git show HEAD:scripts/install.sh`) 쓰라고 넣고, 그래도 원본 대조가 막히면 scratchpad `.txt` 사본을 reviewer 에 준다
- CLI 부수효과를 추측으로 설계했다(marketplace remove 가 플러그인·설정을 지움) → 상태를 바꾸는 claude 명령은 발주 전에 CLAUDE_CONFIG_DIR 격리 실험으로 먼저 확인시킨다
- 서브에이전트의 `install.sh` 실행 통과는 아직 실측 안 됨 → sh 실행 검증은 메인이 `CLAUDE_CONFIG_DIR=<scratchpad>` 격리로 돌리고, ps1 실행·PSScriptAnalyzer 는 사용자가 Windows 에서 돌린다
