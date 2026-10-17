# scripts/
역할: 저장소 검사·릴리스 절차(버전 일치 규칙, 복사본 규칙, 설치 방식)가 바뀔 때 수정된다
공개 진입점: `bash scripts/check.sh` (`--no-test` 또는 `SKIP_PLUGIN_TESTS=true` 면 validate 만) — CI `ci.yml`·`release.yml` 이 호출
의존: 들어오는 것 `.github/workflows/ci.yml`·`release.yml`, 관리자 손 실행 · 나가는 것 `claude`·`node` CLI, `.claude-plugin/marketplace.json`, 각 `<mod>/.claude-plugin/plugin.json`·복사본 파일(읽기만) · 금지: 플러그인 코드 import·수정
| 파일 | 역할 |
|---|---|
| check.sh | 복사본 3쌍 본문 일치(`copies`) + marketplace 의 각 플러그인: 이름·버전이 `plugin.json` 과 일치하는지 + `claude plugin validate` + `claude plugin test` |
테스트: `bash scripts/check.sh --no-test` 로 스스로 실행 확인 (별도 테스트 없음)
규칙:
- 플러그인 목록은 `marketplace.json` 의 `plugins[].source` 에서 읽는다. 플러그인을 더하면 marketplace 만 고치면 검사 대상이 된다.
- 복사본 검사(`copies`)는 `--no-test` 와 무관하게 항상 돈다. 대상: `diff.ts`(1행 제외 전체), `modelName`(`export const modelName ` 부터 0열 `}` 까지), `Hunk`(`export type Hunk =` 한 줄). CRLF 는 LF 로 바꿔 비교. 복사본을 더하거나 함수 형태를 바꾸면 이 추출 규칙도 고친다(못 찾으면 실패).
- 계획만 있고 아직 없는 파일: `install.sh`(Linux/macOS/WSL), `install.ps1`(Windows, CRLF), `bump-version.mjs`(plugin.json+marketplace.json 만, VERSION 은 릴리스 때 손으로) — 사양은 `docs/release/RELEASE.md` 5·6장. 없는 동안 `release.yml` 은 경고만 내고 zip 에서 빼며, `ci.yml` 의 설치 스크립트 검사 단계는 건너뛴다.
- `.ps1` 만 CRLF, 나머지 LF(`.gitattributes`).
ADR: docs/design/baseline.md, docs/release/RELEASE.md
