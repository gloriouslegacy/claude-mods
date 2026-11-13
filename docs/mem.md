# 세션 메모 (갱신 2026-11-13 · b504a0f 이후)

## 끝낸 것
- v2.4.1~v2.6.0 릴리스 완료(git log·CHANGELOG). /clear 실측(2.1.319)과 복구 방식은 agent-flow·pinboard `CLAUDE.md`.
- 2026-11-09 빈 줄 조사 종결 — 띠 아래·qhud 위 빈 줄 모두 호스트 여백, 우리 코드로 못 고침. `⚠qhud:` 접두어는 line 배치 정상 표시.
- 2026-11-13 GitLab 미러 적용(b504a0f): `.github/workflows/mirror-gitlab.yml`(claudeOrchestration 것 복사, 대상 `gloriouslegacy/claude-mods`, checkout@v7). secret `GITLAB_TOKEN` = GitLab project access token `github-mirror-token`(write_repository, 2026-11-13 생성). 첫 실행 성공 — main + 태그 11개.
  - 단방향·`--force --prune`: GitLab 은 읽기 전용 사본.
  - GitLab main 보호 브랜치 force push 기본 꺼짐 → 이력 재작성 시에만 켜야 함.
  - 토큰 만료 시 이 워크플로만 조용히 실패 → 새 토큰 + `gh secret set GITLAB_TOKEN`.

## 열린 것
- 선택: 설치본 marketplace 갱신 후 띠 `AFlow ·` 확인, `/pin test` → /clear → 핀 유지 실측.
- 프로세스 둘이 같은 pinboard store 파일을 공유할 때 덮어쓰기 여부 [모름].

## 다음에
- 게이트 self_protect 오탐 수정은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
