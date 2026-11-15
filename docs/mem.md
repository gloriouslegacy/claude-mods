# 세션 메모 (갱신 2026-11-15 · v2.10.0 5f8f05f 이후)

## 끝낸 것
- v2.4.1~v2.10.0 릴리스(git log·CHANGELOG). GitLab 미러 `.github/workflows/mirror-gitlab.yml`(secret `GITLAB_TOKEN`, 만료 시 조용히 실패 → 새 토큰 + `gh secret set`).
- v2.9.0 (ae8636d): 상태 줄 아이콘 전부 제거. qcompact 화면 실측 완료(11-15, 2.1.325) — 모두 정상.
- v2.10.0 (5f8f05f, 태그 push·release·미러 성공, 명세 `docs/spec/v2.10.0.md`): 프롬프트 위 줄에서 플러그인 이름 제거 — pinboard 0.8.0 `N pins · » M`(`1 pin`), agent-flow 0.12.0 띠만 `main + N agents · …`(pane·`/aflow text` 는 `AFlow ·` 유지).
- v2.10.0 화면 실측(11-15, 사용자, /reload-plugins 뒤): `0 pins · » 20 [Show]`(노랑)·`main + 194 agents · 0 running · 0 waiting [Show]`(자홍)·`[Compact]`(청록) 정상.
- F5(/clear 뒤 » 기록)는 compact 혼동 보고 → 보류.

## 열린 것
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석 "huge costs no more"(실제 선형 스캔), 비 Cf 필러 문자 통과, arm 분기 `$.clock.after` 던지면 `[Compact?]` 잔류.
- 2.1.325 의 /clear 가 atom 을 초기화하는지 [모름](실측 기준은 2.1.319).

## 다음에
- 게이트 self_protect 오탐(커밋 heredoc 속 `install` 류 문구로 추정)은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
