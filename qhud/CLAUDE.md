# qhud/
역할: 상태 줄에 보이는 항목·배치(layout/style)·사용량 엔드포인트 형식이 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 명령 `/qhud-usage`, `/tcw-usage`(이전 이름 안내) · userConfig `layout`·`style`·`model`·`weather`·`ttl`·`git`·`plan` · 렌더 `AbovePrompt`·`PromptHint`·`$.ui.status`
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만), `https://api.anthropic.com/api/oauth/usage`, `git` 프로세스 · 금지: 다른 플러그인 import, 순수 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | 이벤트 구독·명령 등록·엔드포인트 호출·`git status` 실행·렌더 (호스트 API 는 여기만) |
| hooks/view.ts | 한 번 갱신에 모은 값 → 줄 문구(`build`·`bandLines`·`oneLine`) |
| hooks/weather.ts | 컨텍스트 예보 단계·숫자 형식·스파크라인·한도 표시 |
| hooks/plan.ts | 사용량 엔드포인트 URL·헤더·5분 주기·응답 파싱(`planLimits`) |
| hooks/model.ts | 모델 id → 짧은 이름, fallback 체인, settings 의 effort |
| hooks/git.ts | `git status --porcelain=v2 --branch` 파싱 → 한 조각 |
| hooks/cache.ts | 프롬프트 캐시 만료 카운트다운 |
| types/index.d.ts | `TcwView`·`Reading` 등 도메인 타입 + `claude-code` ambient 선언 |
| tests/qhud.test.tsx | 순수 모듈 테스트 |
테스트: `claude plugin test ./qhud` (검증만: `claude plugin validate ./qhud`)
규칙:
- `/api/oauth/usage` 는 비공개 엔드포인트. 응답 형식이 바뀌면 `/qhud-usage` 로 실제 응답을 보고 `plan.ts` 만 고친다. 실패하면 모델별 주간 한도 항목만 숨기고 나머지는 그대로 보인다.
- 엔드포인트는 `PLAN_EVERY_MS`(5분)보다 자주 부르지 않는다. `git status` 는 3초 제한, 실패 시 git 조각만 생략.
- 의도된 복사본(`scripts/check.sh` 가 검사): `hooks/model.ts` 2행~`modelName` 끝(`FAMILIES`·`title` 포함) ↔ `agent-flow/hooks/model.ts`. 고치면 그쪽도 맞춘다. `plan.ts` 의 `FAMILIES` 는 별개다.
- `/tcw-usage` 와 `TcwView` 는 tcw → qhud 이름 변경의 잔재. `/tcw-usage` 는 my-mods v1.2.0 에서 제거 예정(코드 안내 문구 기준).
- `$.store` 는 쓰지 않는다. 세션 상태는 atom `history`·`clock`·`run`·`view`.
ADR: docs/design/baseline.md
