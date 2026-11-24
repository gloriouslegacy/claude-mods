# 세션 메모 (갱신 2026-11-24 · v2.15.0 릴리스·실측)

## 끝낸 것
- v2.4.1~v2.15.0 릴리스(git log·CHANGELOG). GitLab 미러 secret `GITLAB_TOKEN` 만료 시 조용히 실패 → 새 토큰 + `gh secret set`.
- v2.14.0 (qhud 0.22.0): `compact` layout(PromptHint 색 있는 한 줄). 실측 OK.
- v2.15.0 (`docs/spec/v2.15.0.md` F1~F4, qhud 0.23.0, bed3ace): `line` 제거(저장값은 매핑 없이 `bottom`, 사용자 결정), qhud 는 `$.ui.status` 안 씀, context 조각 `CT` 라벨 제거(전 layout). 리뷰 높음 0. 실측 2026-11-24 설치본 OK(/config 3값, compact 줄 `CT` 없음).

## 열린 것
- 실측 안 함: 리셋 시각 실제 재개 submit, 백업 재개, 주간 소진 때 `seven_day` 값.
- 낮음(v2.15.0 리뷰): 테스트의 `ui.status` 빈 값 가드 2개(qhud.test 157·285)는 이제 항상 참, 남은 `on('ui.status')` 스텁은 소음 — 정리 선택.
- 낮음: 알림 문구 시각(리셋)과 취소 문구 시각(재개) 1분 차이 표기.
- 리뷰 낮음 보류(v2.13.0): `markResume` 예외 시 취소 알림 누락, refresh 경합 시 `↻` 최대 15초 빠짐, 출처 없음 = 사람 취급, `usageReport` keys 길이 무제한.
- qhud 낮음 보류(v2.12.1): 백업 변수 1개, 백업 콜백 autoResume 재확인 없음, 리로드 뒤 mainBusy 오판.
- register.tsx 330/350 — 재개 기능 더 붙으면 재개 상태 기계 분리(baseline 3항 ADR 개정) 검토.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러, arm 분기 `[Compact?]` 잔류. validate 경고 qhud gating hook `.catch` 없음(기존).

## 다음에
- 다음 실제 한도 알림 때 리셋 뒤 재개 제출 관찰. 게이트 self_protect `unresolved` 완화는 fable 레포.
