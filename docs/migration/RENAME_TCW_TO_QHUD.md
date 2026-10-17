# tcw → qhud 이름 변경 안내

> 대상: `tcw`(폴더 `token-cache-weather`)를 이미 설치해 쓰고 있는 사용자, 그리고 이 변경을 릴리스하는 관리자
> 적용 버전: my-mods v1.1.0부터 (qhud 0.17.0)

---

## 1. 무엇이 바뀌나

| 항목 | 이전 | 이후 |
|---|---|---|
| 플러그인 이름 | `tcw` | `qhud` |
| 폴더 | `token-cache-weather/` | `qhud/` |
| 설치 이름 | `tcw@my-mods` | `qhud@my-mods` |
| 명령 | `/tcw-usage` | `/qhud-usage` (v1.1.x 동안은 `/tcw-usage`도 동작) |
| 설정 키 | `tcw.layout`, `tcw.style`, `tcw.model`, `tcw.weather`, `tcw.plan`, `tcw.git`, `tcw.ttl` | `qhud.layout`, `qhud.style`, `qhud.model`, `qhud.weather`, `qhud.plan`, `qhud.git`, `qhud.ttl` |
| `line` 레이아웃 접두어 | `⚠ tcw:` | `⚠ qhud:` |

**바뀌지 않는 것:** 화면에 보이는 내용(모델·추론 강도·git·CT·한도 두 줄)과 기능, 다른 플러그인(change-tutor, pinboard, agent-flow).

**이름을 바꾸는 이유:** 날씨 표시, 컨텍스트 게이지, 캐시 시계가 빠지면서 "token-cache-weather"가 실제 기능을 설명하지 못한다. 지금은 세션 상태판(heads-up display) 역할이다. 그냥 `hud`는 다른 플러그인이나 명령과 이름이 겹치기 쉬워서 앞에 `q`를 붙였다.

---

## 2. 사용자: 옮기기 전에 알아둘 것

- **설정값은 자동으로 넘어가지 않는다.** 설정이 플러그인 이름 아래 저장되기 때문이다. 기본값을 그대로 쓰고 있었다면 할 일이 없다. 바꾼 값이 있다면 3장 1단계에서 적어 둔다.
- **잠깐 두 줄이 겹쳐 보일 수 있다.** `tcw`를 지우기 전에 `qhud`를 설치하면 같은 상태판이 두 번 그려진다. 순서대로 하면 생기지 않고, 생겨도 `tcw`를 지우면 사라진다.
- **Claude Code를 쓰는 환경마다 따로 해야 한다.** Windows와 그 안의 WSL은 설정 폴더가 다르다. PC가 여러 대면 PC마다 한다.
- 걸리는 시간: 5분 이내. 진행 중인 Claude Code 세션은 마지막에 다시 불러오면 된다.

---

## 3. 사용자: 옮기는 순서

### 1단계. 지금 설정값 적어 두기

Claude Code에서 `/config`를 열고 `tcw`로 시작하는 줄의 값을 적는다. 기본값과 다른 것만 적으면 된다.

| 설정 | 기본값 | 내 값 |
|---|---|---|
| `tcw.layout` | `bottom` | |
| `tcw.style` | `plain` | |
| `tcw.model` | `true` | |
| `tcw.weather` | `true` | |
| `tcw.plan` | `true` | |
| `tcw.git` | `true` | |
| `tcw.ttl` | `1h` | |

설정 파일을 직접 보고 싶다면 `~/.claude/settings.json`(Windows: `C:\Users\<이름>\.claude\settings.json`)의 `pluginConfigs` 항목 안에서 `tcw`가 들어간 키를 찾는다. 이 파일의 정확한 구조는 Claude Code 버전에 따라 다를 수 있어 **확인 필요**로 둔다. 파일을 직접 고치기 전에 반드시 복사본을 만든다.

### 2단계. 새 버전 받기

설치한 방식에 맞춰 하나만 한다.

**릴리스 zip과 설치 스크립트로 설치한 경우**

설치 스크립트가 2~5단계를 자동으로 처리한다. 스크립트를 실행한 뒤 6단계로 간다.

```bash
# macOS / Linux / WSL
sh my-mods/install.sh
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\my-mods\install.ps1
```

**압축을 직접 풀어 marketplace로 등록한 경우**

새 압축을 **기존과 같은 폴더**에 덮어 푼다. 그다음 기존 `token-cache-weather/` 폴더를 지운다(새 압축에는 `qhud/`가 들어 있다).

**저장소를 marketplace로 연결한 경우(관리자)**

```bash
claude plugin marketplace update my-mods
```

### 3단계. marketplace 갱신

```bash
claude plugin marketplace update my-mods
```

### 4단계. 옛 플러그인 제거

```bash
claude plugin uninstall tcw@my-mods
```

"not installed" 같은 메시지가 나오면 이미 지워진 것이니 다음 단계로 간다.

### 5단계. 새 플러그인 설치

```bash
claude plugin install qhud@my-mods --scope user
```

### 6단계. 설정값 다시 넣기

`/config`에서 `qhud`로 시작하는 줄에 1단계에서 적어 둔 값을 넣는다. 기본값을 쓰던 경우 건너뛴다.

### 7단계. 다시 불러오고 확인하기

열려 있는 Claude Code 세션에서 `/reload-plugins`를 실행하거나 새 세션을 연다.

확인할 것:

- [ ] 프롬프트 아래(또는 설정한 위치)에 상태판 두 줄이 **한 번만** 보인다
- [ ] `/qhud-usage`를 실행하면 사용량 엔드포인트 결과가 나온다
- [ ] `/config`에 `tcw.*` 줄이 남아 있지 않다
- [ ] `/plugin` 목록에 `tcw`가 없고 `qhud`가 있다

---

## 4. 사용자: 직접 경로로 불러오던 경우

`--plugin-dir`이나 환경변수 `CLAUDE_CODE_PLUGIN_DIRS`로 플러그인 폴더를 지정해 쓰고 있었다면 경로의 폴더 이름만 바꾼다.

```bash
# 이전
claude --plugin-dir ./token-cache-weather --plugin-dir ./pinboard
# 이후
claude --plugin-dir ./qhud --plugin-dir ./pinboard
```

```json
// ~/.claude/settings.json — 이전
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\<이름>\\claude-mods\\token-cache-weather;C:\\Users\\<이름>\\claude-mods\\pinboard" } }
// 이후
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\<이름>\\claude-mods\\qhud;C:\\Users\\<이름>\\claude-mods\\pinboard" } }
```

경로를 바꾸지 않으면 폴더가 없어서 상태판이 아예 나오지 않는다.

---

## 5. 사용자: 문제가 생겼을 때

| 증상 | 원인 | 해결 |
|---|---|---|
| 상태판이 두 번 보인다 | `tcw`와 `qhud`가 둘 다 설치됨 | `claude plugin uninstall tcw@my-mods` 후 `/reload-plugins` |
| 상태판이 안 보인다 | `qhud`가 설치되지 않았거나, 직접 경로가 옛 폴더를 가리킴 | `/plugin` 목록 확인, 5단계 다시 실행, 4장의 경로 확인 |
| 설정이 기본값으로 돌아갔다 | 설정 키 이름이 바뀜(정상) | 6단계 |
| `qhud@my-mods`를 찾을 수 없다고 나온다 | marketplace가 갱신되지 않음 | 3단계 다시 실행 후 5단계 |
| `/tcw-usage`가 안 된다 | v1.2.0부터 옛 명령 제거 | `/qhud-usage` 사용 |

**되돌리기:** 설치 스크립트를 쓴 경우 `install.sh --rollback` / `install.ps1 -Rollback`으로 바로 전 버전(tcw)으로 돌아간다. 그 뒤 `claude plugin uninstall qhud@my-mods`, `claude plugin install tcw@my-mods --scope user`로 맞춘다.

---

## 6. 관리자: 코드 변경 목록

v1.1.0에서 아래 항목(설치 스크립트 제외)을 반영했고, `bash scripts/check.sh`로 4개 플러그인 검사·테스트(qhud 19개 포함)를 통과했다. 같은 종류의 이름 변경을 다시 할 때의 점검표로 남겨 둔다.

| 파일 | 변경 |
|---|---|
| 폴더 | `git mv token-cache-weather qhud` (기록 유지) — 완료 |
| `qhud/.claude-plugin/plugin.json` | `"name": "qhud"`, 버전 0.17.0, 설명 갱신 |
| `.claude-plugin/marketplace.json` | 항목 이름 `qhud`, `source: ./qhud`, 버전 0.17.0 |
| `qhud/hooks/register.tsx` | `atom({ plugin: 'tcw', ... })` 4곳 → `'qhud'`. 상태 저장소 이름은 플러그인 이름과 같아야 검사를 통과한다 |
| `qhud/types/index.d.ts` | `PluginState`의 `'tcw'` 키 → `'qhud'` |
| `qhud/hooks/register.tsx` | 명령 `qhud-usage` 등록, `tcw-usage`는 같은 동작에 "/tcw-usage is now /qhud-usage" 안내를 붙여 v1.1.x 동안 유지 |
| 파일 머리 주석 | `// tcw:` → `// qhud:` |
| `qhud/tests/*` | 상태 키, 명령 이름, `line` 접두어 기대값 |
| `README.md`, `README.ko.md` | 이름, 명령표, 설정표, 설치 명령, `--plugin-dir` 예시 |
| `docs/release/RELEASE.md` | 플러그인 표와 폴더 트리 |
| `CHANGELOG.md` | v1.1.0 단락 맨 위에 "이름 변경: tcw → qhud, 설정 다시 넣기 필요, 안내: docs/migration/RENAME_TCW_TO_QHUD.md" |
| `VERSION` | `1.1.0` (사용자가 할 일이 생기는 변경이라 minor) |
| `scripts/install.sh`, `install.ps1` | 아래 7장의 자동 처리 |
| 이 문서 | `docs/migration/RENAME_TCW_TO_QHUD.md`로 저장소에 넣는다 |

변경 후 `bash scripts/check.sh`로 4개 플러그인 검사·테스트를 통과시킨다.

---

## 7. 관리자: 설치 스크립트의 자동 처리

설치 스크립트가 3장 3~5단계를 대신하게 한다. 사용자는 1단계(설정 적기)와 6단계(설정 넣기)만 직접 한다.

1. `claude plugin list`(또는 같은 정보를 주는 명령) 결과에 `tcw@my-mods`가 있으면 이름 변경 대상으로 본다.
2. 설치 전에 한 번 알린다: "tcw가 qhud로 이름이 바뀝니다. /config에서 바꾼 tcw 설정이 있으면 지금 적어 두세요." 계속할지 묻는다(`--yes`로 건너뛰기 가능).
3. `claude plugin uninstall tcw@my-mods` → `claude plugin install qhud@my-mods --scope user`.
4. 끝에 "설정을 /config의 qhud 항목에 다시 넣으세요"를 출력한다.
5. 설정을 자동으로 옮기는 기능(settings.json의 `tcw` 항목을 `qhud`로 바꾸기)은 설정 파일 구조가 확인된 뒤에 추가한다. 확인 전에는 사용자의 settings.json을 스크립트가 고치지 않는다.

`--dry-run`에서는 위 동작을 출력만 한다.

---

## 8. 관리자: 일정

| 버전 | 내용 |
|---|---|
| v1.1.0 | 이름 변경. `/tcw-usage`는 안내 문구와 함께 계속 동작. 설치 스크립트가 옛 플러그인을 바꿔 줌 |
| v1.1.x | 같은 상태 유지. 관리자 PC들과 WSL에서 옮겨졌는지 확인 |
| v1.2.0 | `/tcw-usage` 제거. 설치 스크립트의 옛 이름 처리는 계속 둔다(늦게 업데이트하는 PC용) |
