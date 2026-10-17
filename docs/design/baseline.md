# 0001 구조 기준선 (현재 구조 기록)
상태: 초안      날짜: 2026-10-17

코드에서 읽은 현재 구조를 "결정된 것"으로 적는다. 바꾸자는 제안은 맨 아래 별도 절에만 둔다.

## 조건
- 요구사항서(`docs/requirements/`) 없음. 변경 축은 코드·`docs/release/RELEASE.md` 에서 읽었다:
  - V1 Claude Code 함수 훅 API 가 버전마다 바뀐다(RELEASE.md 9장)
  - V2 qhud 가 읽는 비공개 엔드포인트 `/api/oauth/usage` 응답 형식이 바뀐다(RELEASE.md 9.2)
  - V3 플러그인별 기능·화면·`userConfig` 가 따로 바뀌고 따로 버전이 오른다
- C1 빌드 단계·package.json 없음. TypeScript 는 호스트가 직접 컴파일, 외부 패키지 사용 불가.

## 결정 (모두 "지금 도입" = 현재 상태)
1. **모듈 경계**: 플러그인 4개(`agent-flow/`·`change-tutor/`·`pinboard/`·`qhud/`)는 서로 독립이다. 서로 import 하지 않는다. `scripts/` 는 저장소 도구이며 플러그인 코드를 import 하지 않고 JSON 만 읽는다.
2. **의도된 복사본**(공유 코드 대신 복사):
   - `agent-flow/hooks/diff.ts` = `change-tutor/hooks/diff.ts` (1행 머리 주석만 다름, 1행 제외 전체 비교).
   - `modelName` 과 그것이 쓰는 `FAMILIES`·`title`(`model.ts` 2행~`modelName` 끝): `agent-flow/hooks/model.ts` = `qhud/hooks/model.ts`. qhud 쪽에는 `chainName`·`settingsEffort` 가 더 있다.
   - `Hunk` 타입 한 줄: agent-flow ↔ change-tutor 각 `types/index.d.ts`.
   - `shortPath`: agent-flow `flow.ts` ↔ change-tutor `tutor.ts`.
   - 한쪽을 고치면 다른 쪽도 같은 커밋에서 맞춘다. `scripts/check.sh` 의 `copies` 단계가 위 4쌍을 항상 검사한다.
3. **I/O 경계**: 플러그인마다 `hooks/register.tsx` 하나만 `'claude-code'` 를 import 하고 `$`(EngineInterface)를 만진다. 시계(`$.clock`)·저장(`$.store`)·네트워크(`$.http`)·프로세스(`$.process`)·모델(`$.model`)·화면(`$.ui`) 접근은 전부 여기다. 나머지 `hooks/*.ts` 는 순수 함수(파싱·계산·문구)이며 현재 시각도 인자로 받는다.
4. **의존 방향**: `register.tsx` → 순수 모듈 → `../types`. 순수 모듈끼리는 단방향(예: qhud `view`→`weather`, `plan`→`weather`(타입); agent-flow `stats`→`flow`→`model`). 순수 모듈은 `register.tsx` 를 import 하지 않는다.
5. **도메인 타입**: 플러그인마다 `types/index.d.ts` 한 장(손으로 씀). 앞부분은 도메인 타입, 끝은 `declare module 'claude-code' { … }` 로 호스트 API ambient 선언. 호스트 API 를 새로 쓰면 여기에 선언을 더한다. `.claude-plugin/types/` 는 엔진 생성물, 커밋 안 함.
6. **인터페이스**: 호스트 API 를 감싸는 어댑터 인터페이스는 두지 않는다. `register.tsx` 가 그 역할(연결 계층)을 한다.
7. **데이터 소유권**: 세션 상태는 `atom({ plugin, key })`, 키는 플러그인 이름 아래. 세션을 넘는 사용자 데이터는 `$.store` — agent-flow `log`(최근 3000), change-tutor `notes`(최근 100), pinboard `pins:<folder>`(폴더별 50). 각 플러그인은 자기 store 만 읽고 쓴다. 설정은 `plugin.json` `userConfig`(호스트가 `options` 로 전달).
8. **캐시**: 별도 캐시 계층 없음. qhud 는 사용량 엔드포인트를 최대 5분마다(`PLAN_EVERY_MS`) 읽고 결과를 atom 에 둔다. git 상태는 갱신 주기마다 `git status` 를 3초 제한으로 실행.
9. **외부 의존**: `claude-code`(호스트)와 `claude-code/testing`(테스트) 외 0개.
10. **버전 이중 기록**: 플러그인 버전은 `<mod>/.claude-plugin/plugin.json` 과 `.claude-plugin/marketplace.json` 두 곳. `scripts/check.sh` 가 이름·버전 일치를 검사한다. 묶음 버전은 루트 `VERSION`.
11. **테스트**: 플러그인마다 `tests/<mod>.test.tsx` 한 장, 순수 모듈만 직접 import 해 검증. `register.tsx` 는 테스트하지 않는다(호스트 필요).

## 근거
- 플러그인은 사용자가 골라 설치한다(`install --plugins`). 공유 폴더가 있으면 zip·marketplace 의 `source` 단위가 깨지고, 한 플러그인만 설치할 때 의존이 따라가지 않는다.
- 빌드·번들 단계가 없어서 플러그인 폴더 밖 파일을 상대 경로로 import 할 수 있는지 보장되지 않는다(호스트 로더 의존).
- V1(호스트 API 변경)의 영향을 `register.tsx`·`types/index.d.ts` 두 파일로 가둔다. 순수 모듈과 테스트는 호스트 없이 돈다.
- V2 는 `qhud/hooks/plan.ts` 하나로 가둔다(URL·헤더·응답 파싱이 한 파일).

## 검토한 대안
- **A. 저장소 공유 폴더 `shared/`(diff·model)를 두고 각 플러그인이 `../../shared/diff` 로 import**
  - 장점: 복사본 동기화 실수가 사라진다. diff 수정 1회.
  - 단점: 플러그인 폴더가 자기완결이 아니게 된다 — marketplace `source` 가 플러그인 폴더라 설치 위치에서 `shared/` 가 보이는지 호스트 동작에 달렸다(미검증). `claude plugin validate ./<mod>` 단독 검증도 깨질 수 있다. 플러그인별 독립 버전과 공유 코드 버전이 엇갈린다.
- **B. 공유 폴더를 원본으로 두고 스크립트로 각 플러그인에 복사(생성 파일)**
  - 장점: 자기완결 유지 + 원본 하나. `check.sh` 에 "복사본 = 원본" 검사를 붙일 수 있다.
  - 단점: 생성 단계가 하나 늘고, 생성물을 직접 고치는 실수를 막을 장치가 또 필요하다. 복사본 4쌍·약 100줄은 `check.sh` 의 `copies` 검사로 충분해 과하다.
- **C. 호스트 API 어댑터 인터페이스(`$` 래퍼)를 플러그인마다 둔다**
  - 장점: `register.tsx` 도 가짜 구현으로 테스트 가능.
  - 단점: 구현체가 호스트 하나뿐이고 `claude-code/testing` 이 `mock` 을 준다. 지금은 간접 계층만 늘어난다.

## 결과
- 영향 모듈: 4개 플러그인 전부, `scripts/check.sh`.
- 현재 자동 검사: `check.sh`(이름·버전 일치 + `claude plugin validate`/`test`), `copies` 단계(복사본 4쌍 동일성), CI `ci.yml`·`release.yml`. import 방향 검사는 없다.
- 로그: 로그 라이브러리 없음. 사용자에게는 `$.ui.toast`·`$.ui.status`, 실패는 대부분 조용히 무시(예: git·엔드포인트 실패 시 그 항목만 숨김).
- 줄 수 상한·모듈 안내 파일 전체 적용 여부: 저장소에 정해진 값 없음 → 사용자 결정 대기.

## 변경 제안 (결정 아님)
- 도입됨(2026-10-17): `check.sh` 의 `copies` 단계가 복사본 4쌍을 검사한다. 대안 B 는 동기화 누락이 이 검사를 통과해 발생하면 다시 검토.
- 도입 조건: `register.tsx` 에서 호스트 없이 재현 못 하는 버그가 반복되면 → 대안 C 검토.
