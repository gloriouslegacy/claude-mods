# 세션 메모 (갱신 2026-11-18 · v2.13.0)

## 끝낸 것
- v2.4.1~v2.13.0 릴리스(git log·CHANGELOG). GitLab 미러 secret `GITLAB_TOKEN` 만료 시 조용히 실패 → 새 토큰 + `gh secret set`.
- v2.13.0 (`docs/spec/v2.13.0.md`, qhud 0.21.0): 재개 실패 3회차 원인 = `task-notification` 출처 프롬프트가 `prompt.submit` 에서 사용자 취소로 처리돼 `dropped`(2026-11-18 onDongne 65ac2388, 03:01 알림 → 05:11 재개 없음). 수정: `byPerson`(composer·bridge·sdk·출처 없음만 취소), 취소 시 토스트+메인 context, 알림 문구 "even if you stop now", 한도 줄 끝 `↻ HH:MM`. 사전 분할로 `options.ts`·`stackLines`·`usageReport` 이동, register.tsx 332줄.
- 실측(2026-11-18 07:51, 문턱 상한만 푼 스크래치 복사본 `--plugin-dir`, /tmp/qhud-try): `↻ 12:01` 표시 OK(bottom), 사람 입력 `test` 뒤 즉시 사라짐 OK, 메인 context 에 알림+취소 문구 둘 다 붙음 OK, 상태 줄 중복 없음. 취소 토스트는 화면 캡처에 안 잡혀 미확인.

## 열린 것
- 실측 안 함: 리셋 시각 실제 재개 submit(장시간 `$.clock.after`·idle 중 `$.prompt.submit`), 백업 재개, 주간 소진 때 `seven_day` 값.
- 낮음: 알림 문구 시각은 리셋(12:00), 취소 문구는 재개 시각(12:01) — 1분 차이 표기 불일치.
- 리뷰 낮음 보류(v2.13.0): `markResume` 예외 시 취소 알림 누락, refresh 경합 시 `↻` 최대 15초 빠짐, 출처 없음 = 사람 취급(fail-safe), `usageReport` keys 길이 무제한(기존).
- qhud 낮음 보류(v2.12.1): 백업 변수 1개, 백업 콜백 autoResume 재확인 없음, 리로드 뒤 mainBusy 오판.
- register.tsx 332/350 — 재개 기능 더 붙으면 재개 상태 기계 분리(baseline 3항 ADR 개정) 검토.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러, arm 분기 `[Compact?]` 잔류. validate 경고 qhud gating hook `.catch` 없음(기존).

## 다음에
- 다음 실제 한도 알림 때 리셋 뒤 재개 제출 관찰. 게이트 self_protect `unresolved` 완화는 fable 레포(`docs/issue/agent-issue.md` 2026-11-18).
