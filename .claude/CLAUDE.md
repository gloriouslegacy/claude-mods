# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

`my-mods` marketplace: Claude Code 함수 훅(function hooks) 플러그인 4개 — `qhud`(상태 줄), `change-tutor`(변경 학습 노트 pane), `pinboard`(`/pin` 메모), `agent-flow`(main·subagent pane). Claude Code 2.1.287 이상 필요. 사용자 안내는 `README.md`(영문)·`README.ko.md`(한국어), 배포 체계 전체는 `docs/release/RELEASE.md`.

## 명령

```bash
bash scripts/check.sh              # 전 플러그인 버전 일치 검사 + validate + test (CI와 동일)
bash scripts/check.sh --no-test    # validate만 (SKIP_PLUGIN_TESTS=true 와 같음)
claude plugin validate ./<mod>     # 한 플러그인만 검증
claude plugin test ./<mod>         # 한 플러그인 테스트 (파일 단위 실행은 확인되지 않음)
claude --plugin-dir ./<mod>        # 한 세션에만 로드해 수동 확인; 수정 후 /reload-plugins
```

- `check.sh` 는 `claude`·`node` 가 PATH 에 있어야 한다. package.json·tsconfig·빌드 단계는 없다 — TypeScript 는 호스트(Claude Code)가 직접 컴파일한다.

## 구조 (4개 플러그인 공통)

- `<mod>/.claude-plugin/plugin.json`: 이름·버전·`types`·`userConfig`(사용자가 `/config` 에서 바꾸는 키, 기본값 포함).
- `<mod>/hooks/hooks.json` 은 `{ "modules": ["./register.tsx"] }` 뿐이다. `register.tsx` 가 `register: Register = (on, options) => …` 를 export 하고, `on(...)` 으로 엔진 이벤트를 구독하며 `$.command.register(...)` 로 슬래시 명령을 등록한다.
- **호스트 API 를 만지는 파일은 `register.tsx` 하나.** 나머지 `hooks/*.ts` 는 순수 함수(문구·계산·파싱)이고 `'claude-code'` 를 import 하지 않는다. 로직은 순수 모듈에 두고 `register.tsx` 는 연결만 한다.
- 호스트 API: `import { atom, read, update } from 'claude-code'`, 타입 `EngineInterface`·`Register`. 세션 상태는 `atom({ plugin, key } as const, initial)`, 세션을 넘는 저장은 `$.store.get/set`(agent-flow `log`, pinboard `pins:<folder>`, change-tutor 노트 목록 — 업데이트 후에도 유지돼야 하는 사용자 데이터).
- `<mod>/types/index.d.ts` 는 손으로 쓴 파일: 도메인 타입 + 파일 끝의 `declare module 'claude-code' { … }`(호스트 API 의 ambient 선언). 호스트 API 를 새로 쓰면 여기에 선언을 더한다.
- `<mod>/.claude-plugin/types/` 는 엔진이 머신마다 생성하는 파일이다. 커밋하지 않는다(`.gitignore`).
- 테스트: `<mod>/tests/<mod>.test.tsx`, `import { expect, mock, test } from 'claude-code/testing'`. 호스트 없이 `../hooks/*` 순수 모듈을 직접 import 해 검증한다.
- import 는 확장자 없는 상대 경로(`'./diff'`, `'../types'`). 외부 의존성은 없다(`claude-code` 만).
- 플러그인끼리 코드를 import 하지 않는다. 공유가 필요한 코드는 의도된 복사본으로 두고 손으로 맞춘다(목록은 `docs/structure.md`, 결정은 `docs/design/baseline.md`).
- 모듈별 사실(명령·`userConfig`·`$.store` 키·복사본·외부 호출)은 각 `<mod>/CLAUDE.md`·`scripts/CLAUDE.md` 에 있다. 모듈 색인은 `docs/structure.md`.

## 규칙

- 파일 첫 줄은 모듈을 설명하는 영문 머리 주석. 코드 주석은 영문. 사용자 화면에 보이는 문구도 영문으로 통일한다.
- 줄바꿈은 `.gitattributes` 로 고정: `.ps1` 만 CRLF, 나머지(`.sh`·`.ts`·`.tsx`·`.json`·`.md`·`.yml`) LF.
- 플러그인 버전은 `<mod>/.claude-plugin/plugin.json` 과 `.claude-plugin/marketplace.json` 의 같은 항목을 **반드시 함께** 올린다(어긋나면 marketplace 갱신이 안 먹고 `check.sh` 가 실패). 화면·`userConfig` 키가 바뀌면 minor, 내부 수정은 patch.
- 묶음 버전 `VERSION`: 어느 플러그인이든 minor 이상이면 번들 minor, patch 만이면 번들 patch. `CHANGELOG.md` 맨 위에 `## vX.Y.Z (YYYY-MM-DD)` 절이 있어야 CI 가 통과하고, 그 절이 릴리스 노트가 된다.
- `userConfig` 키 이름 변경·삭제는 사용자의 `/config` 값을 날린다 — CHANGELOG 에 "설정 이름 변경"으로 분명히 적는다.
- 기능·명령·설정을 바꾸면 `README.md` 와 `README.ko.md` 를 함께 고친다(PR 템플릿 체크 항목).
- 릴리스: `v*` 태그 push → `release.yml` 이 check 후 tests 를 뺀 zip + `SHA256SUMS.txt` 를 게시. 태그는 지우거나 다시 찍지 않는다.
- 설치 스크립트·`bump-version.mjs` 는 아직 없다(계획, `scripts/CLAUDE.md`). 그동안 릴리스는 설치 스크립트 없이 나가고(경고만) 사용자는 README 수동 설치를 따른다. 버전은 두 파일을 손으로 함께 올린다.
- 릴리스 zip 구성: 플러그인 폴더(`tests/`·엔진 types·`CLAUDE.md`·`CLAUDE.local.md` 제외) + `docs/migration/`(README 링크 대상) + 루트 문서. zip 에 들어가는 경로를 바꾸면 `release.yml` 과 README 링크를 함께 고친다.
