# agent-flow/
역할: 에이전트 pane·프롬프트 위 띠의 표시 항목·멈춤 신호 기준·실행 기록/통계 형식·자동 열기·띠 접힘이 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 명령 `/aflow`(pane 열기), `/aflow text`, `/aflow stats [기간]` · userConfig `slowSeconds`(60)·`slowShellSeconds`(180)·`silentSeconds`(120)·`log`(true)·`autoOpen`(false, v0.7.0~)·`band`(true)·`showFlow`(false = 접힌 채 시작) · 렌더 `Pane`·`AbovePrompt`(버튼 key `aflow-fold`, 행 버튼 `aflow-` 접두)
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만; `$.agent.list`·`$.store`·`$.clock`·`$.ui`) · 금지: 다른 플러그인 import, 순수·렌더 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | spawn·turn·tool 이벤트로 에이전트 행 갱신, 실행 기록 저장, 명령, Pane·AbovePrompt 연결, 첫 session.start 자동 열기·띠 접힘, 띠 버튼 → `showInPane(isSame)`(열기/전환/같은 화면이면 닫기) (호스트 API 는 여기만) |
| hooks/view.tsx | 렌더 모듈(baseline 3항 예외): `ui`(=`$.ui.resolve(e)`)·상태·콜백을 인자로 `flowView`·`diffView`·`mainRow`·`agentRow`(`RowButtons` key `prefix`: pane `''`, 띠 `'aflow-'`)·`doingTail`·`bandView` |
| hooks/flow.ts | 토큰 수·라벨·경과 시간·트리 순서·지금 하는 일, `headline`, `newRow`, `shouldTick`, `shouldAutoOpen`, `KEEP_CHANGES`·`KEEP_LINES`, `shortPath` |
| hooks/stats.ts | 실행 기록(`LOG_KEY`·`KEEP_LOG` 3000, `logEntry`·`asLog`·`appendLog`)과 `/aflow stats` 집계 |
| hooks/model.ts | 모델 id → 짧은 이름 (qhud 와 복사본) |
| hooks/diff.ts | 도구 patch 정규화·변경 수·표시용 자르기 |
| types/index.d.ts | `AgentRow`·`MainRow`·`Change`·`LogEntry`·`Hunk`·`Ui`(손으로 쓴 Record — validate 가 inline `import('claude-code')` 를 막음) 등 + `claude-code` ambient 선언 |
| tests/agent-flow.test.tsx | 순수 모듈 테스트 + 가짜 호스트로 Pane·띠·자동 열기 mount. 469줄 — 상한 500, 새 테스트는 별도 파일로 |
| tests/tick.test.tsx · tests/band-buttons.test.tsx | 반복 session.start 에도 2초 틱 1개 · 띠 버튼 → pane 열기·전환·다시 누르면 닫기·거부 토스트 |
테스트: `claude plugin test ./agent-flow` (검증만: `claude plugin validate ./agent-flow`)
규칙:
- 의도된 복사본(`scripts/check.sh` 가 검사): `hooks/model.ts` 2행~`modelName` 끝(`FAMILIES`·`title` 포함) ↔ `qhud/hooks/model.ts`. 고치면 같은 커밋에서 상대쪽도 맞춘다.
- `$.store` 키 `log`: 끝난 서브에이전트 실행 1건 1줄, 최근 3000건, `log` 설정이 false 면 쓰지 않는다. 업데이트 후에도 유지돼야 하는 데이터 — 항목 형식을 바꾸면 옛 항목 읽기를 남긴다.
- 프로세스의 첫 `session.start` 1회(`hasStarted`)에서만 `autoOpen === true` 면 pane 을 열고(실패는 삼킴, 토스트 1회) `showFlow !== true` 면 띠를 접는다. resume·compact(·clear, 2.1.319 타입은 clear 때 안 온다고 적음 — 미확인)는 사용자가 고른 상태 유지. 접힘은 세션 atom `folded` 전용.
- 띠(명세 v2.4.0 F2, 버튼 v2.5.0 F1, 토글 v2.5.1 F1): `band` 꺼짐·`hasSurvey`·roster 서브 0개면 `next(e)` 그대로. 우리 줄 위, `next(e)`(다른 mod) 아래. 펼치면 main·서브 각 1줄 + pane 과 같은 버튼, 상세·diff 는 띠에 안 그림 — 누르면 `view` atom 을 바꾸고 `$.ui.open`(거부 시 누름마다 토스트). pane 이 보이고 이미 그 화면이면 `$.ui.close`(view 불변).
- 띠와 Pins 줄의 위아래는 호스트의 플러그인 순서(목록 앞 = 바깥 = 위)가 정한다. 순서 옵션 없음 — marketplace 에서 agent-flow 를 pinboard 앞에 둔다(보장 아님, v2.5.0 F2).
- 2초 틱은 pane 이 앞에 보이거나(`$.ui.panes()`) 띠가 펼쳐져 있을 때만. 호스트는 session.start 사이에 타이머를 정리하지 않으므로 `ticker?.cancel()` 뒤 다시 걸어 늘 1개(v0.7.1). 실행 기록·종료 판정은 `turn.complete` 에서 하고 틱에 기대지 않는다.
- 명령 이름은 `agent…` 로 시작하지 않는다(Claude Code 2.1.302 가 `/agent-flow` 를 명령 목록에서 깨뜨려 그림, v1.3.0 에서 제거).
- Agent·Monitor 처럼 기다리는 것이 본래 동작인 도구는 slow 표시하지 않는다.
ADR: docs/design/baseline.md · 명세: docs/spec/v1.4.0.md, docs/spec/v2.0.0.md, docs/spec/v2.4.0.md, docs/spec/v2.5.0.md, docs/spec/v2.5.1.md
