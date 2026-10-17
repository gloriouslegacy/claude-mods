# change-tutor/
역할: 학습 노트의 내용(요청·이유·diff)·pane 화면·설명/퀴즈 프롬프트가 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 명령 `/change-tutor [on | off]` · userConfig `enabled`(기본 false)·`model`(haiku/sonnet/opus) · 렌더 `Pane`, `$.ui.status` 노트 수
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만; `$.model.complete`·`$.store`·`$.ui`) · 금지: 다른 플러그인 import, 순수 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | Edit/Write 를 노트로 기록, 설명·퀴즈 모델 호출, 복사, pane 렌더 (호스트 API 는 여기만) |
| hooks/tutor.ts | 목록 선택·라벨·튜터 프롬프트·퀴즈 파싱, `KEEP_NOTES`(100), `shortPath`(agent-flow 와 복사본) |
| hooks/diff.ts | 도구 patch 정규화·변경 수 계산·표시용 자르기 (agent-flow 와 복사본) |
| types/index.d.ts | `Hunk`·`Note`·`Quiz`·`View` + `claude-code` ambient 선언 |
| tests/change-tutor.test.tsx | 순수 모듈 테스트 |
테스트: `claude plugin test ./change-tutor` (검증만: `claude plugin validate ./change-tutor`)
규칙:
- 의도된 복사본(`scripts/check.sh` 가 검사): `hooks/diff.ts` 전체와 `types/index.d.ts` 의 `Hunk` ↔ agent-flow, `hooks/tutor.ts` 의 `shortPath` ↔ `agent-flow/hooks/flow.ts`. 고치면 같은 커밋에서 그쪽도 맞춘다.
- `$.store` 키 `notes`: 최근 100건, 업데이트 후에도 유지돼야 하는 사용자 데이터. 형식을 바꾸면 옛 값 읽기를 남긴다.
- 기본 꺼짐. `/change-tutor on|off` 는 그 세션에만 적용, 영구 설정은 `enabled`.
- 노트 대상은 메인 에이전트의 Edit·Write 만(`agentId` 있으면 건너뜀). 서브에이전트 변경은 agent-flow 의 `sub_Diff` 몫.
- 설명·퀴즈는 `$.model.complete` 로 토큰을 쓴다(버튼을 눌렀을 때만).
ADR: docs/design/baseline.md
