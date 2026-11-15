# 세션 메모 (갱신 2026-11-16 · v2.11.0 a80830a 이후)

## 끝낸 것
- v2.4.1~v2.10.0 릴리스(git log·CHANGELOG). GitLab 미러 `.github/workflows/mirror-gitlab.yml`(secret `GITLAB_TOKEN`, 만료 시 조용히 실패 → 새 토큰 + `gh secret set`).
- v2.10.0 (5f8f05f): 프롬프트 위 줄에서 플러그인 이름 제거, 화면 실측 정상(11-15).
- v2.11.0 (a80830a, 태그 push·release·미러·ci 성공, 명세 `docs/spec/v2.11.0.md`): qhud 0.19.0 한도 임박 알림 — 남은 % ≤ `alertLeft`(기본 5)면 창·리셋당 1회 토스트 + 메인 `tool.call`/`prompt.submit` context(서브 제외). 새 userConfig `alert`·`alertLeft`. 창 이름 24자·문구당 창 4개 상한.
- 게이트 log 감사(11-16) 오탐 묶음 → `docs/issue/agent-issue.md`. 시나리오 PASS 2924 / FAIL 0.

## 열린 것
- v2.11.0 화면 실측 안 함(실제 95% 도달 시 토스트·context 확인). `/reload-plugins` 뒤 확인.
- qhud 알림 낮음 보류: refresh 동시 실행 시 토스트 2회 가능, 알림 붙은 프롬프트가 drop 되면 알림 소실.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석 "huge costs no more", 비 Cf 필러 문자 통과, arm 분기 `$.clock.after` 던지면 `[Compact?]` 잔류.
- validate 경고: qhud `classic.SessionStart`·`classic.PreModelSwitch` gating hook 에 `.catch` 없음(기존).

## 다음에
- 게이트 self_protect 오탐은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
