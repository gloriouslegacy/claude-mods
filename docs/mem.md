# 세션 메모 (갱신 2026-11-24 · v2.14.0 릴리스)

## 끝낸 것
- v2.4.1~v2.14.0 릴리스(git log·CHANGELOG). GitLab 미러 secret `GITLAB_TOKEN` 만료 시 조용히 실패 → 새 토큰 + `gh secret set`.
- v2.13.0 (qhud 0.21.0): 재개 취소는 사람 입력(`byPerson`)만, 취소 토스트+메인 context, `↻ HH:MM`. 실측 OK(취소 토스트만 미확인).
- v2.14.0 (`docs/spec/v2.14.0.md` F1, qhud 0.22.0, 4b40cdc): `line` 단색·`⚠ qhud:` 는 호스트 `$.ui.status` 설계 → 새 값 `compact`(PromptHint 색 있는 한 줄). 실측 2026-11-24 설치본 OK. `style` 무시는 권장대로 유지.

## 열린 것
- 실측 안 함: 리셋 시각 실제 재개 submit, 백업 재개, 주간 소진 때 `seven_day` 값.
- 낮음: 알림 문구 시각(리셋)과 취소 문구 시각(재개) 1분 차이 표기.
- 리뷰 낮음 보류(v2.13.0): `markResume` 예외 시 취소 알림 누락, refresh 경합 시 `↻` 최대 15초 빠짐, 출처 없음 = 사람 취급, `usageReport` keys 길이 무제한.
- qhud 낮음 보류(v2.12.1): 백업 변수 1개, 백업 콜백 autoResume 재확인 없음, 리로드 뒤 mainBusy 오판.
- register.tsx 333/350 — 재개 기능 더 붙으면 재개 상태 기계 분리(baseline 3항 ADR 개정) 검토.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러, arm 분기 `[Compact?]` 잔류. validate 경고 qhud gating hook `.catch` 없음(기존).

## 다음에
- 다음 실제 한도 알림 때 리셋 뒤 재개 제출 관찰. 게이트 self_protect `unresolved` 완화는 fable 레포.
