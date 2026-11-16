# 세션 메모 (갱신 2026-11-17 · v2.12.1 260bab4)

## 끝낸 것
- v2.4.1~v2.12.1 릴리스(git log·CHANGELOG). GitLab 미러 secret `GITLAB_TOKEN` 만료 시 조용히 실패 → 새 토큰 + `gh secret set`.
- v2.12.1 (`docs/spec/v2.12.1.md`, qhud 0.20.1): 알림 보낸 차단 창도 재개 예약(소진 창 우선), `dropped` 집합과 같은 시각만 거부, 첫 재개 +240초 백업(메인 `turn.start` 없음 + idle). 원인 실측: 95% 알림 뒤 메인이 스스로 멈춰 100% 미도달. 자동 결정 기록 `docs/issue/auto-decisions.md`(미확인).

## 열린 것
- 화면 실측 안 함: 알림 뒤 멈춤 → 리셋+60초 재개·+5분 백업, 실제 엔진에서 재개 submit 이 `turn.start` 를 내는지, 주간 소진 때 `seven_day` 값, 핫 리로드 때 `$.clock.after` 정리.
- qhud 낮음 보류: 백업 변수 1개(4분 안 연속 재개), 백업 콜백 autoResume 재확인 없음, 리로드 뒤 mainBusy 오판, 첫 재개 뒤·백업 전 사용자 취소 테스트 없음.
- `register.tsx` 344/350줄 — 다음 기능은 분할 먼저.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러, arm 분기 `[Compact?]` 잔류. validate 경고 qhud gating hook `.catch` 없음(기존).

## 다음에
- 위 화면 실측부터. 게이트 self_protect 오탐은 fable 레포에서(`docs/issue/agent-issue.md`).
