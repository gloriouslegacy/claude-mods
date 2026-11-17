# 세션 메모 (갱신 2026-11-18 · v2.13.0)

## 끝낸 것
- v2.4.1~v2.13.0 릴리스(git log·CHANGELOG). GitLab 미러 secret `GITLAB_TOKEN` 만료 시 조용히 실패 → 새 토큰 + `gh secret set`.
- v2.13.0 (`docs/spec/v2.13.0.md`, qhud 0.21.0): 재개 실패 3회차 원인 = `task-notification` 출처 프롬프트가 `prompt.submit` 에서 사용자 취소로 처리돼 `dropped`(2026-11-18 onDongne 65ac2388, 03:01 알림 → 05:11 재개 없음). 수정: `byPerson`(composer·bridge·sdk·출처 없음만 취소), 취소 시 토스트+메인 context, 알림 문구 "even if you stop now", 한도 줄 끝 `↻ HH:MM`. 사전 분할로 `options.ts`·`stackLines`·`usageReport` 이동, register.tsx 332줄.

## 열린 것
- 화면 실측 안 함: 실제 엔진에서 재개 submit·`↻` 표시·취소 토스트, 장시간 `$.clock.after`, idle 중 `$.prompt.submit` 수락, 주간 소진 때 `seven_day` 값.
- 보류(2회차): 리셋 시각 이전 사람 입력이 재개를 취소하는 규칙은 설계대로 유지 — 이제 취소 토스트로 보임.
- 리뷰 낮음 보류(v2.13.0): `markResume` 예외 시 취소 알림 누락, refresh 경합 시 `↻` 최대 15초 빠짐, 출처 없음 = 사람 취급(fail-safe), `usageReport` keys 길이 무제한(기존).
- qhud 낮음 보류(v2.12.1): 백업 변수 1개, 백업 콜백 autoResume 재확인 없음, 리로드 뒤 mainBusy 오판.
- register.tsx 332/350 — 재개 기능 더 붙으면 재개 상태 기계 분리(baseline 3항 ADR 개정) 검토.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러, arm 분기 `[Compact?]` 잔류. validate 경고 qhud gating hook `.catch` 없음(기존).

## 다음에
- onDongne 등에서 0.21.0 로드 뒤(`/reload-plugins`) 재개·`↻`·취소 토스트 관찰. 게이트 self_protect 오탐은 fable 레포에서(`docs/issue/agent-issue.md`).
