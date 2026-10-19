# scripts/
역할: 저장소 검사·설치·릴리스 절차(버전 일치 규칙, 복사본 규칙, 설치 방식)가 바뀔 때 수정된다
공개 진입점: `bash scripts/check.sh`(CI `ci.yml`·`release.yml` 이 호출) · 사용자용 `sh install.sh` / `install.ps1`(lib 와 함께 릴리스 zip 의 `my-mods/` 루트로 복사됨, 옵션은 `--help`·RELEASE.md 6.2)
의존: 들어오는 것 CI·관리자·사용자 · 나가는 것 `claude`·`node`·`git` CLI, `curl`/`wget`·`gh`·GitHub API, `marketplace.json`·`plugin.json`·복사본 파일(읽기만) · 금지: 플러그인 코드 import·수정
| 파일 | 역할 |
|---|---|
| check.sh | 복사본 4쌍 본문 일치(`copies`) + 각 플러그인 이름·버전이 `plugin.json` 과 일치 + `claude plugin validate`·`test` |
| install.sh | Linux/macOS/WSL 진입: 인자·도움말, 설치 폴더 가드, Claude 확인, 번들 확보(다운로드·체크섬·풀기), lib 찾아 모드 호출 (POSIX sh, LF) |
| install-lib.sh | 교체·복구, marketplace 등록, 플러그인 설치·update, `--rollback`·`--uninstall`, 완료 안내. 머리 주석에 진입→lib 계약 |
| install.ps1 · install-lib.ps1 | Windows 같은 짝 (PowerShell 5.1·7, ASCII, CRLF) |
테스트: `bash scripts/check.sh --no-test` · 설치기는 `sh scripts/install.sh --dry-run`, `./scripts/install.ps1 -DryRun`(CI `scripts` 잡이 진입·lib 네 파일 lint 와 함께 실행)
규칙:
- 복사본 검사(`copies`)는 `--no-test` 와 무관하게 항상 돈다. 대상: `diff.ts`(1행 제외 전체), `model.ts` 2행~`modelName` 끝, `Hunk` 한 줄, `shortPath`. CRLF 는 LF 로 바꿔 비교. 복사본을 더하면 추출 규칙과 `docs/structure.md`·모듈 `CLAUDE.md` 목록도 고친다.
- `install.sh`·`install.ps1` 은 같은 동작을 유지한다(한쪽을 고치면 다른 쪽도): scope 는 user 만, 플러그인 제거는 `--keep-data`, 이미 설치된 플러그인은 `plugin update`(캐시 복사본), 롤백은 설치된 것만 update, 플러그인 선택은 교체 전에 진입에서 검증, `--dir` 은 홈·루트·설정 폴더 자체 거부(링크를 풀어 비교하는 것은 sh 만 — ps1 은 경로 문자열 비교) + 표식(`.claude-plugin/marketplace.json`) 없는 `current`/`previous` 는 건드리지 않음, 삭제는 설치 폴더 하위만.
- 기본 설치 폴더는 `${CLAUDE_CONFIG_DIR:-~/.claude}/claude-mods`(v1.3.0~). 옛 위치 감지·삭제 코드는 두지 않는다.
- lib 찾는 순서: (install) 확보한 번들 → 진입 파일 옆 → `<설치폴더>/current` → `previous`. 없으면 중단. 진입→lib 계약(변수·함수)을 바꾸면 lib 머리 주석과 반대쪽 설치기를 함께 고친다.
- marketplace 경로를 옮길 때는 같은 이름으로 `marketplace add` 만 다시 한다. `marketplace remove` 는 플러그인 uninstall 과 `/config` 값 삭제를 함께 하므로 `--uninstall` 에서만 쓴다(`uninstall --keep-data` 도 설정값은 지운다 — 2026-10-17 격리 실험).
- 상태를 바꾸는 `claude plugin …` 명령을 새로 쓰기 전에는 `CLAUDE_CONFIG_DIR=<임시폴더>` 격리 환경에서 부수효과를 먼저 확인한다.
- 각 파일 500줄 미만(v1.3.0 분할 뒤 sh 328·lib 223, ps1 347·lib 202). 진입 파일에는 단독 실행(`curl | sh`·`irm | iex`)에 필요한 것만 두고 나머지는 lib 로 보낸다. 설치기 파일을 더하면 `release.yml` 복사·존재 검사와 `ci.yml` lint 를 함께 고친다.
- 이 `install.*` 는 fable 설치기가 아니라 게이트 규칙 A 대상이 아니다: 리터럴 경로의 `sh -n`·`--dry-run`(`CLAUDE_CONFIG_DIR` 를 임시폴더로)·`git show`/`diff` 는 통과, `$변수`·heredoc 속 경로는 보수적으로 막힌다(2026-10-19 WSL2·fable 0.11.7 확인). ps1 실행 검증은 사용자가 Windows 에서 한다.
- `bump-version.mjs` 는 계획(plugin.json+marketplace.json 만, VERSION 은 릴리스 때 손으로).
ADR: docs/design/baseline.md, docs/release/RELEASE.md, docs/spec/v1.3.0.md
