# 세션 메모 (갱신 2026-11-09 · v2.6.0 f19110f 이후, 작업 트리 깨끗)

## 끝낸 것
- v2.4.1~v2.6.0 릴리스 완료(git log·CHANGELOG). /clear 실측(2.1.319)과 복구 방식은 agent-flow·pinboard `CLAUDE.md`.
- v2.6.0 (f19110f, 태그·push, release·ci 성공): agent-flow 0.9.0 화면 이름 'AFlow'(F1).
- 2026-11-09 빈 줄 조사 종결 — 둘 다 Claude Code(호스트) 여백, 우리 코드로 못 고침:
  - 띠 아래 빈 줄: 띠가 하나라도 있으면 맨 아래 띠 밑에 생김(pinboard 단독에서도 있음 실측). 엔진 기본 출력(`next(e)`) 제거 실험도 효과 없어 원복.
  - qhud 위 빈 줄: bypass permissions 줄 위에 늘 있음(line·bottom 배치 모두).
  - `⚠qhud:` 접두어는 line 배치 때 호스트가 붙이는 정상 표시.

## 열린 것
- 선택: 설치본 marketplace 갱신 후 띠 `AFlow ·` 확인, `/pin test` → /clear → 핀 유지 실측.
- 프로세스 둘이 같은 pinboard store 파일을 공유할 때 덮어쓰기 여부 [모름].

## 다음에
- 게이트 self_protect 오탐 수정은 claudeOrchestration(fable) 레포에서(`docs/issue/agent-issue.md`).
