# 세션 메모 (갱신 2026-11-15 · v2.9.0 ae8636d 이후)

## 끝낸 것
- v2.4.1~v2.8.0 릴리스(git log·CHANGELOG). GitLab 미러 `.github/workflows/mirror-gitlab.yml`(secret `GITLAB_TOKEN`, 만료 시 조용히 실패 → 새 토큰 + `gh secret set`).
- v2.8.0 화면 실측(11-15, 2.1.325): `<Text>` 자식 색 정상, `🗜` 은 글자와 겹쳐 깨짐, `📌`·`🤖` 정상.
- v2.9.0 (ae8636d, 태그 push·release 성공, 명세 `docs/spec/v2.9.0.md`): 상태 줄 아이콘 전부 제거 — pinboard 0.7.0·agent-flow 0.11.0·qcompact 0.3.0. 프롬프트 문구의 `📌` 는 유지.
- F5(/clear 뒤 » 기록)는 사용자가 compact 와 혼동한 보고 → 수정·테스트 되돌리고 보류.

## 열린 것
- 화면 실측 전: qcompact 5초 만료·두 번 눌러 압축·`[Compacting…]` 유지(`$.command.run` resolve 시점)·핫 리로드 뒤 confirm 잔류.
- 보안 낮음 보류(v2.8.0): `cleanReason` 주석 "huge costs no more"(실제 선형 스캔), 비 Cf 필러 문자 통과, arm 분기 `$.clock.after` 던지면 `[Compact?]` 잔류.
- 2.1.325 의 /clear 가 atom 을 초기화하는지 [모름](실측 기준은 2.1.319).

## 다음에
- 게이트 self_protect 오탐(커밋 heredoc 속 `install` 류 문구로 추정 — 11-15 또 발생)은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
