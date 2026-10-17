# pinboard/
역할: `/pin` 문법·메모 목록 규칙·Claude 에게 전달하는 문구와 시점이 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 명령 `/pin <note>` (`!` 중요, `!!` 중단 후 전달), `/pin done N`·`undo N`·`rm N`·`clear`·`list`·`help`, `/pin`(접기) · userConfig `deliver`(기본 true) · 렌더 `AbovePrompt`
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만; `$.session.append`·`$.turn.abort`·`$.prompt.submit`·`$.store`) · 금지: 다른 플러그인 import, 순수 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | 명령 처리·폴더별 저장·대화에 메모 전달·`!!` 중단·렌더 (호스트 API 는 여기만) |
| hooks/pins.ts | `/pin` 파싱(`parse`)·목록 변경·Claude 가 읽는 문구·`HELP`·`storeKey`·`KEEP_PINS`(50) |
| types/index.d.ts | `Pin` + `claude-code` ambient 선언 |
| tests/pinboard.test.tsx | 순수 모듈 테스트 |
테스트: `claude plugin test ./pinboard` (검증만: `claude plugin validate ./pinboard`)
규칙:
- `$.store` 키 `pins:<folder>`(세션 cwd 기준), 폴더별 최근 50개. 업데이트 후에도 유지돼야 하는 사용자 데이터 — 키 형식을 바꾸면 옛 메모가 사라진다.
- 전달(`deliver` 켜짐): 대기 중이면 `$.prompt.submit` 으로 바로 프롬프트, 턴 중이면 `$.session.append` 로 붙여 다음 단계에 읽히고 그 전에 턴이 끝나면 `turn.complete` 에서 후속 프롬프트로. `!!` 는 `$.turn.abort` 후 `turn.complete` 에서 제출(중단 실패 시 append 로 대체). 서브에이전트 턴(`agentId` 있음)은 무시.
- `/pin` 명령 문법을 바꾸면 `HELP` 문구와 README 두 벌을 함께 고친다.
ADR: docs/design/baseline.md
