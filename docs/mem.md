# 세션 메모 (갱신 2026-11-16 · v2.12.0 55f7450 이후)

## 끝낸 것
- v2.4.1~v2.11.0 릴리스(git log·CHANGELOG). GitLab 미러 `.github/workflows/mirror-gitlab.yml`(secret `GITLAB_TOKEN`, 만료 시 조용히 실패 → 새 토큰 + `gh secret set`).
- v2.11.0 (a80830a, 명세 `docs/spec/v2.11.0.md`): qhud 0.19.0 한도 임박 알림(`alert`·`alertLeft`).
- v2.12.0 (55f7450, 태그 push·release·ci·미러 모두 성공, 명세 `docs/spec/v2.12.0.md`): qhud 0.20.0 — `drawLines` → `hooks/draw.tsx` 분리, `alertLeftWeekly`(기본 2), `autoResume`(기본 켜짐, `hooks/resume.ts`, 지난/8일 초과 시각 거부·사용자 프롬프트 취소·발화 시각 floor·동기 판정). qhud 51 pass.
- 게이트 log 감사(11-16) 오탐 묶음 → `docs/issue/agent-issue.md`.

## 열린 것
- 화면 실측 안 함: v2.11.0·v2.12.0 알림·자동 재개 동작(`/reload-plugins` 뒤 실제 한도 소진 시), 핫 리로드 때 호스트가 `$.clock.after` 타이머를 정리하는지(안 하면 재개 2회 가능), 실제 엔진의 `prompt.submit` origin 값.
- qhud 낮음 보류: 알림 붙은 프롬프트가 drop 되면 알림 소실. atom `resume` 은 기록만(정리 후보). r3 는 reviewer 재검토 없이 수용(재현 테스트 FAIL→PASS).
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러 문자 통과, arm 분기 `$.clock.after` 던지면 `[Compact?]` 잔류.
- validate 경고: qhud `classic.SessionStart`·`classic.PreModelSwitch` gating hook 에 `.catch` 없음(기존).

## 다음에
- 위 화면 실측부터.
- 게이트 self_protect 오탐은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
