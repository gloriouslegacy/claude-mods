# 세션 메모 (갱신 2026-11-16 · v2.11.0 a80830a 이후)

## 끝낸 것
- v2.4.1~v2.11.0 릴리스(git log·CHANGELOG). GitLab 미러 `.github/workflows/mirror-gitlab.yml`(secret `GITLAB_TOKEN`, 만료 시 조용히 실패 → 새 토큰 + `gh secret set`).
- v2.11.0 (a80830a, 명세 `docs/spec/v2.11.0.md`): qhud 0.19.0 한도 임박 알림(`alert`·`alertLeft`).
- 게이트 log 감사(11-16) 오탐 묶음 → `docs/issue/agent-issue.md`.
- v2.12.0 구현 완료·미커밋(11-16, 명세 `docs/spec/v2.12.0.md`): qhud 0.20.0 — `drawLines` → `hooks/draw.tsx` 분리, F1 `alertLeftWeekly`(기본 2), F2 `autoResume`(기본 켜짐, 새 `hooks/resume.ts`, r2·r3 방어: 지난/8일 초과 시각 거부·사용자 프롬프트 취소·발화 시각 floor·동기 판정). reviewer·security-reviewer 통과(높음 없음), qhud 51 pass, `check.sh` 전체 통과. VERSION 2.12.0·CHANGELOG·README 2벌·qhud/CLAUDE.md 반영.

## 열린 것
- v2.12.0 커밋·태그·push 는 사용자 승인 대기.
- 실측 안 함: 핫 리로드 때 호스트가 `$.clock.after` 타이머를 정리하는지(안 하면 재개 2회 가능), 실제 엔진의 `prompt.submit` origin 값, v2.11.0·v2.12.0 알림·재개 화면 동작.
- qhud 알림 낮음 보류: 알림 붙은 프롬프트가 drop 되면 알림 소실. atom `resume` 은 기록만(정리 후보).
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석, 비 Cf 필러 문자 통과, arm 분기 `$.clock.after` 던지면 `[Compact?]` 잔류.
- validate 경고: qhud `classic.SessionStart`·`classic.PreModelSwitch` gating hook 에 `.catch` 없음(기존).

## 다음에
- 게이트 self_protect 오탐은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
