# qhud/
역할: 상태 줄에 보이는 항목·배치(layout/style)·사용량 엔드포인트 형식·한도 임박 알림·자동 이어하기가 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 명령 `/qhud-usage` · userConfig `layout`·`style`·`model`·`weather`·`ttl`·`git`·`plan`·`alert`·`alertLeft`·`alertLeftWeekly`·`autoResume` · 렌더 `AbovePrompt`·`PromptHint`·`$.ui.status` · 모델 context(메인 `tool.call`·`prompt.submit`) · `$.prompt.submit`(자동 이어하기) · 메인 `turn.start`·`turn.complete`(백업 재개 판정)
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만), `https://api.anthropic.com/api/oauth/usage`, `git` 프로세스 · 금지: 다른 플러그인 import, 순수 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | 이벤트 구독·명령 등록·엔드포인트 호출·`git status`·렌더·알림·재개 타이머 연결 (호스트 API 는 여기만, 350줄 상한 근접) |
| hooks/draw.tsx | 렌더 모듈(baseline 3항 예외): `drawLines(ui, v, style)` — `$.ui.resolve(e)` 결과·뷰·style → 줄 트리 |
| hooks/view.ts · hooks/weather.ts | 모은 값 → 줄 문구(`build`·`bandLines`·`oneLine`) · 예보 단계·숫자 형식·스파크라인·한도 표시 |
| hooks/plan.ts | 사용량 엔드포인트 URL·헤더·5분 주기·응답 파싱(`planLimits`·`scopeName`) |
| hooks/alert.ts | 한도 임박 판정(주간 `alertLeftWeekly`, 5h·spend `alertLeft`)·창·리셋당 1회·알림 문구 |
| hooks/resume.ts | 예약 대상(소진 창 우선, 없으면 알림 보낸 차단 창)·재개 시각(`resumeAt`·`shouldArm`)·백업(`backupAt`·`shouldBackup`)·재개 문구 |
| hooks/model.ts | 모델 id → 짧은 이름, fallback 체인, settings 의 effort |
| hooks/git.ts · hooks/cache.ts | `git status --porcelain=v2 --branch` 파싱 · 프롬프트 캐시 만료 카운트다운 |
| types/index.d.ts | `TcwView`·`Reading`·`AlertState`·`ResumeState`·`Ui` 등 도메인 타입 + `claude-code` ambient 선언 |
| tests/qhud.test.tsx · tests/tick.test.tsx | 순수 모듈 · 반복 session.start 에도 15초 틱 1개(가짜 호스트) |
| tests/alert.test.tsx · tests/resume.test.tsx | 알림 판정·메인만 context · 재개 판정·예약·재예약·취소·발화·백업(가짜 호스트) |
테스트: `claude plugin test ./qhud` (검증만: `claude plugin validate ./qhud`)
규칙:
- `/api/oauth/usage` 는 비공개 엔드포인트. 응답 형식이 바뀌면 `/qhud-usage` 로 실제 응답을 보고 `plan.ts` 만 고친다. 실패하면 모델별 주간 한도 항목만 숨긴다. `PLAN_EVERY_MS`(5분)보다 자주 부르지 않는다.
- `git status` 는 3초 제한, 실패 시 git 조각만 생략. 15초 틱은 `ticker?.cancel()` 뒤 다시 걸어 늘 1개(v0.18.1).
- 알림은 메인(`agentId` 없음)에만 context 로 붙인다. 한도 목록은 `refresh` 가 합친 것을 재사용(v0.19.0).
- 자동 이어하기(v0.20.1, 명세 `docs/spec/v2.12.1.md`): 재개 타이머 `resumer`, 판정은 `await` 전 동기. 울렸거나 사용자 프롬프트로 취소된 시각은 집합 `dropped` 에 두고 다시 걸지 않으며, 그 밖에는 걸린 시각과 다르면 이르든 늦든 다시 건다. 백업 `backup` 은 첫 재개 발화 때 +240초로 걸고, 그 뒤 메인 턴이 없고 idle 일 때만 제출. 사용자 프롬프트·`autoResume` 끔이면 둘 다 취소. atom `resume` 은 기록만.
- 의도된 복사본(`scripts/check.sh` 가 검사): `hooks/model.ts` 2행~`modelName` 끝 ↔ `agent-flow/hooks/model.ts`. `plan.ts` 의 `FAMILIES` 는 별개다.
- `TcwView` 는 tcw → qhud 이름 변경의 잔재(타입 이름만). `$.store` 는 쓰지 않는다. 세션 상태는 atom `history`·`clock`·`run`·`view`·`alert`·`resume`.
ADR: docs/design/baseline.md
