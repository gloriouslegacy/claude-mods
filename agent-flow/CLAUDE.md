# agent-flow/
역할: 에이전트 pane 의 표시 항목·멈춤 신호 기준·실행 기록/통계 형식이 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 명령 `/agent-flow`(pane 열기), `/agent-flow text`, `/agent-flow stats [기간]` · userConfig `slowSeconds`(60)·`slowShellSeconds`(180)·`silentSeconds`(120)·`log`(true) · 렌더 `Pane`
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만; `$.agent.list`·`$.store`·`$.clock`·`$.ui`) · 금지: 다른 플러그인 import, 순수 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | spawn·turn·tool 이벤트로 에이전트 행 갱신, 실행 기록 저장, 명령·pane 렌더 (호스트 API 는 여기만) |
| hooks/flow.ts | 토큰 수·라벨·경과 시간·트리 순서·지금 하는 일, `KEEP_CHANGES`·`KEEP_LINES` |
| hooks/stats.ts | 실행 기록(`LOG_KEY`·`KEEP_LOG` 3000)과 `/agent-flow stats` 집계 |
| hooks/model.ts | 모델 id → 짧은 이름 (qhud 와 복사본) |
| hooks/diff.ts | 도구 patch 정규화·변경 수·표시용 자르기 (change-tutor 와 복사본) |
| types/index.d.ts | `AgentRow`·`MainRow`·`Change`·`LogEntry`·`Hunk` 등 + `claude-code` ambient 선언 |
| tests/agent-flow.test.tsx | 순수 모듈 테스트 |
테스트: `claude plugin test ./agent-flow` (검증만: `claude plugin validate ./agent-flow`)
규칙:
- `hooks/diff.ts` 는 `change-tutor/hooks/diff.ts` 와 1행 머리 주석만 다른 복사본, `types/index.d.ts` 의 `Hunk` 도 동일. `hooks/model.ts` 는 `qhud/hooks/model.ts` 의 `modelName` 과 본문 동일. 고치면 같은 커밋에서 상대쪽도 맞춘다.
- `$.store` 키 `log`: 끝난 서브에이전트 실행 1건 1줄, 최근 3000건, `log` 설정이 false 면 쓰지 않는다. 업데이트 후에도 유지돼야 하는 데이터 — 항목 형식을 바꾸면 옛 항목 읽기를 남긴다.
- pane 은 `/agent-flow` 로만 열린다(자동으로 열지 않는다).
- Agent·Monitor 처럼 기다리는 것이 본래 동작인 도구는 slow 표시하지 않는다.
ADR: docs/design/baseline.md
