# qcompact/
역할: 입력창 위 [Compact] 버튼(두 번 눌러 호스트 내장 /compact 실행)의 표시·색·확인 단계·실행 방식·실패 문구가 바뀔 때 수정된다
공개 진입점: `hooks/hooks.json` → `register.tsx` 의 `register` · 렌더 `AbovePrompt` 버튼 하나(`key="compact"`) · 슬래시 명령·userConfig 없음
의존: 들어오는 것 없음(호스트가 로드) · 나가는 것 `claude-code`(register.tsx 만; `$.command.run`·`$.clock.after`·`$.ui.toast`·`$.ui.log`·`<Button>`·`<Text>`) · 금지: 다른 플러그인 import, 순수 모듈의 `claude-code` import
| 파일 | 역할 |
|---|---|
| hooks/register.tsx | 버튼 렌더(`<Button label>` 안에 `<Text {...look(phase)}>` 자식 — Button 은 color·bold 를 안 받음)·클릭 처리·5초 만료 타이머·`$.command.run({ command: 'compact' })`·`logFailure`(로그가 던져도 삼킴). 토스트·`expiry?.cancel()` 은 각각 try 로 감싸 phase 가 멈추지 않게 (호스트 API 는 여기만) |
| hooks/confirm.ts | 상태 전이 `press`·`expire`(idle → confirm → running, 만료 → idle, running 중 클릭 무시)·`label`(`🗜 [Compact]`·`🗜 [Compact?]`·`🗜 [Compacting…]`)·`look`(cyan bold·yellow bold·dim)·`CONFIRM_MS`(5000)·`failure`·`cleanReason`(C0·C1·줄 구분자·`\p{Cf}`·U+FE00–FE0F → 공백, 앞 공백은 `search` 로 건너뛰고 401 유닛만 잘라 200 코드포인트, 비문자열·빈 값 `unknown error`) |
| types/index.d.ts | `Phase`·`Action` 타입 + `claude-code` ambient 선언(atom `phase` 의 `PluginState` 만) |
| tests/qcompact.test.tsx | `confirm.ts` 순수 함수 테스트 20개(`\p{…}` 지원 확인 포함) |
테스트: `claude plugin test ./qcompact` (검증만: `claude plugin validate ./qcompact`)
규칙:
- 압축은 호스트 내장 경로만 쓴다. `$.model.complete`·`session.compact` 훅 가로채기로 자체 요약을 만들지 않는다(명세 v2.7.0 F1).
- 호스트 설문(`hasSurvey`)이 띠를 차지한 동안은 버튼을 그리지 않고 `next(e)` 로 양보한다(pinboard 와 같음).
- 확인 만료 5초. 만료·실패·완료 모두 idle 로 돌아간다. 실패는 토스트 + `$.ui.log` 한 줄, 문구는 항상 `cleanReason` 을 거친다.
- `cleanReason` 결과는 옛 방식(전체 치환·trim 뒤 자르기)과 같아야 한다 — 바꾸면 fuzz 로 비교(v2.8.0 F1, 20만 건 불일치 0).
- 정규식의 유니코드 이스케이프는 `\u{XXXX}` + `u` 플래그로 쓴다(Edit 도구가 `\uXXXX` 를 실제 문자로 바꿔 U+2028 이 정규식을 깨뜨린 적 있음).
- 상태는 세션 atom 전용 — `$.store` 에 쓰지 않는다.
- 실측 전: `$.command.run` resolve 시점·핫 리로드 뒤 `confirm` 잔류·`<Text>` 자식 색이 버튼에 그려지는지·`🗜` 폭 [모름].
- 아이디어 출처: effortless(HeyCubit, MIT). 코드를 복사하면 MIT 고지를 넣어야 하므로 복사하지 않는다.
ADR: docs/design/baseline.md · 명세: docs/spec/v2.7.0.md, docs/spec/v2.8.0.md
