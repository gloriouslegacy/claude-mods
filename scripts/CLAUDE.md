# scripts/
역할: 저장소 검사·설치·릴리스 절차(버전 일치 규칙, 복사본 규칙, 설치 방식)가 바뀔 때 수정된다
공개 진입점: `bash scripts/check.sh`(CI `ci.yml`·`release.yml` 이 호출) · 사용자용 `sh install.sh` / `install.ps1`(릴리스 zip 의 `my-mods/` 루트로 복사됨, 옵션은 `--help`·RELEASE.md 6.2)
의존: 들어오는 것 CI·관리자·사용자 · 나가는 것 `claude`·`node`·`git` CLI, `curl`/`wget`·`gh`·GitHub API, `marketplace.json`·`plugin.json`·복사본 파일(읽기만) · 금지: 플러그인 코드 import·수정
| 파일 | 역할 |
|---|---|
| check.sh | 복사본 4쌍 본문 일치(`copies`) + 각 플러그인 이름·버전이 `plugin.json` 과 일치 + `claude plugin validate`·`test` |
| install.sh | Linux/macOS/WSL 설치·업데이트·`--rollback`·`--uninstall`·`--dry-run` (POSIX sh, LF) |
| install.ps1 | Windows 같은 기능 (PowerShell 5.1·7, CRLF) |
테스트: `bash scripts/check.sh --no-test` · 설치기는 `sh scripts/install.sh --dry-run`, `./scripts/install.ps1 -DryRun`(CI `scripts` 잡이 shellcheck·PSScriptAnalyzer 와 함께 실행)
규칙:
- 복사본 검사(`copies`)는 `--no-test` 와 무관하게 항상 돈다. 대상: `diff.ts`(1행 제외 전체), `model.ts` 2행~`modelName` 끝, `Hunk` 한 줄, `shortPath`. CRLF 는 LF 로 바꿔 비교. 복사본을 더하면 추출 규칙과 `docs/structure.md`·모듈 `CLAUDE.md` 목록도 고친다.
- `install.sh`·`install.ps1` 은 같은 동작을 유지한다(한쪽을 고치면 다른 쪽도): scope 는 user 만, 플러그인 제거는 `--keep-data`, 이미 설치된 플러그인은 `plugin update`(캐시 복사본), 롤백은 설치된 것만 update, `--dir` 은 홈·루트 거부 + 표식(`.claude-plugin/marketplace.json`) 없는 `current`/`previous` 는 건드리지 않음, 삭제는 설치 폴더 하위만.
- marketplace 경로를 옮길 때는 같은 이름으로 `marketplace add` 만 다시 한다. `marketplace remove` 는 플러그인 uninstall 과 `/config` 값 삭제를 함께 하므로 `--uninstall` 에서만 쓴다(`uninstall --keep-data` 도 설정값은 지운다 — 2026-10-17 격리 실험).
- 상태를 바꾸는 `claude plugin …` 명령을 새로 쓰기 전에는 `CLAUDE_CONFIG_DIR=<임시폴더>` 격리 환경에서 부수효과를 먼저 확인한다.
- 두 설치기 모두 500줄 상한 직전(sh 492·ps1 498줄)이다. 기능을 더하려면 먼저 분할하고 `release.yml` 의 zip 복사 목록을 함께 고친다.
- `install.*` 실행(dry-run 포함)은 fable-gate 가 막는다 — 실행 검증은 사용자가 터미널에서 한다.
- `bump-version.mjs` 는 계획(plugin.json+marketplace.json 만, VERSION 은 릴리스 때 손으로).
ADR: docs/design/baseline.md, docs/release/RELEASE.md
