# 구조 색인

기준: `docs/design/baseline.md`(0001). 현황(크기·부채)은 `docs/map.md`(자동 생성).

## 모듈

| 모듈 | 역할 | 의존 |
|---|---|---|
| `qhud/` | 프롬프트 위·아래 상태 줄: 모델·effort·fallback, git, 컨텍스트 사용률, 5시간/주간/모델별 주간 한도, 캐시 만료 경고 | 호스트 `claude-code`(`$.http`·`$.process`·`$.settings` 포함), 비공개 `/api/oauth/usage` |
| `change-tutor/` | 메인 에이전트가 고친 파일마다 학습 노트 pane(요청·이유·diff·쉬운 설명·퀴즈) | 호스트 `claude-code`(`$.model.complete`·`$.store`) |
| `pinboard/` | `/pin` 고정 메모, 새 메모를 대화에 즉시 전달, `!!` 는 턴 중단 후 전달, 폴더별 보관 | 호스트 `claude-code`(`$.session.append`·`$.turn.abort`·`$.store`) |
| `agent-flow/` | `/agent-flow` pane: 메인·서브에이전트 상태·모델·토큰·멈춤 신호·diff, 실행 기록 통계 | 호스트 `claude-code`(`$.agent.list`·`$.store`) |
| `scripts/` | 저장소 도구: `check.sh`(버전 일치 + validate + test). 설치 스크립트·`bump-version.mjs` 는 계획만 | `claude`·`node` CLI, `.claude-plugin/marketplace.json`, 각 `plugin.json` |

저장소 단위 파일: `.claude-plugin/marketplace.json`(플러그인 목록·버전), `VERSION`(묶음 버전), `CHANGELOG.md`, `README.md`·`README.ko.md`, `.github/workflows/`(ci·release).

## 의존 방향

- 플러그인 4개는 서로 의존하지 않는다. 각 플러그인 안: `hooks/register.tsx` → `hooks/*.ts`(순수) → `types/index.d.ts`. `claude-code` 는 `register.tsx` 만 import.
- `scripts/`·CI → `marketplace.json`·`plugin.json`(읽기만). 플러그인 → `scripts/` 의존 없음.
- 의도된 복사본(import 아님, 손으로 동기화): 4쌍 — `diff.ts`(1행 제외 전체) agent-flow ↔ change-tutor, `modelName`+`FAMILIES`·`title`(`model.ts` 2행~`modelName` 끝) agent-flow ↔ qhud, `Hunk` 타입 한 줄 agent-flow ↔ change-tutor, `shortPath` agent-flow `flow.ts` ↔ change-tutor `tutor.ts`. `scripts/check.sh` 의 `copies` 단계가 항상 검사한다.
