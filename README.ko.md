# my-mods (한국어 안내)

Claude Code 모드(함수 훅 플러그인) 4개입니다. **Claude Code 2.1.287 이상**이 필요합니다. 화면에 표시되는 문구는 모두 영어입니다.

---

## 명령어 한눈에 보기

| 명령 | 예시 | 동작 |
|---|---|---|
| `/pin <메모>` | `/pin 렌더 끝나면 드라이브에 올리기` | 메모 고정 후 Claude에게 전달 |
| `/pin ! <메모>` | `/pin ! 배포 전에 .env 키 확인` | 위와 같고 중요 표시(빨간 ★) |
| `/pin !! <메모>` | `/pin !! 멈추고 기존 API 유지해` | Claude의 작업을 끊고 바로 전달 |
| `/pin done N` / `/pin undo N` | `/pin done 2` | 2번 완료 / 되돌리기 |
| `/pin rm N` | `/pin rm 1` | 1번 삭제 |
| `/pin clear` | `/pin clear` | 완료된 메모 모두 삭제 |
| `/pin list` | `/pin list` | 목록 출력 |
| `/pin` | `/pin` | 보드 접기/펼치기 |
| `/change-tutor` | `/change-tutor` | Change Notes 패널 열기 |
| `/change-tutor on` / `off` | `/change-tutor on` | 이번 세션에서 변경 기록 시작 / 중지(change-tutor는 기본 꺼짐) |
| `/aflow` | `/aflow` | Agent flow 패널 열기(메인·서브에이전트의 모델, 토큰, 호출 수, 지금 하는 일, diff) |
| `/aflow text` | `/aflow text` | 에이전트 트리를 텍스트로 출력 |
| `/aflow stats [일수]` | `/aflow stats 30` | 기록된 서브에이전트 실행을 에이전트·모델별로 합산(기본 7일) |
| `/qhud-usage` | `/qhud-usage` | 사용량 엔드포인트를 바로 조회해 응답 출력 |

---

## 1. 설명

### qhud — 세션 상태 한눈에 보기 (이전 이름 tcw)

프롬프트 아래에 2줄로 표시합니다(`qhud.layout`: `bottom`, 기본값). `band`로 바꾸면 프롬프트 위에 표시합니다. 앞에 플러그인 이름이 붙지 않습니다.

```
Opus 5.5 · high · ⤷ Sonnet › Haiku   ⎇ main ↑2 ~3   CT 67%
0% (2d 11h)  |  98% (2h16m)  |  82% (2d 12h)
```

`qhud.layout`을 `line`으로 바꾸면 같은 내용을 프롬프트 아래 상태줄 한 줄로 보여줍니다. 이때는 Claude Code가 앞에 `⚠ qhud:`를 붙이기 때문에 이름을 짧게 했습니다.

| 항목 | 뜻 |
|---|---|
| `Opus 5.5` | 현재 모델(1M 컨텍스트 버전은 `(1M)`), `/model`로 바꾸면 따라 바뀜 |
| `high` | 마지막 응답의 추론 강도(`low` / `medium` / `high` / `xhigh` / `max`, `--effort`·`/effort`로 설정). 첫 응답 전에는 settings에 그 모델용으로 적힌 `effortLevel`(`{ "claude-opus-5-5": { "effortLevel": "high" } }`), 없으면 맨 위 `effortLevel` |
| `⤷ Sonnet › Haiku` | settings.json의 `fallbackModel`에 적힌 폴백 체인. 폴백 모델이 응답하는 동안은 `⤷ now Sonnet 4.5`. 명령줄 `--fallback-model`로만 준 체인은 모드가 읽을 수 없어서, 폴백이 실제로 응답할 때만 보임 |
| `⎇ main ↑2 ~3` | git 상태: 브랜치(분리된 HEAD는 `@1a2b3c4`), `↑` 푸시할 커밋, `↓` 받아올 커밋, `+` 스테이징됨, `~` 수정됨, `?` 추적 안 됨, `!` 충돌. 깨끗하면 `✓`. 저장소가 아니면 생략 |
| `CT 67%` | 컨텍스트 사용률. 첫 응답 전에는 `-%`. 막대는 50% 넘으면 노랑, 80% 넘으면 빨강 |
| `98% (2h16m)` · `82% (2d 12h)` | 5시간·주간(전체 모델) 사용 한도의 남은 비율과 리셋까지 남은 시간. 50% 미만 노랑, 20% 미만 빨강. 구독 계정만 표시 |
| `0% (2d 11h)` | `/usage`처럼 모델별 주간 한도(이름 없이 맨 앞). 계정에 별도 한도가 있는 모델만 표시. 계정 사용량 엔드포인트를 최대 5분마다 읽음(토큰 사용 없음). `qhud.plan` = `false`로 끔. `/qhud-usage`로 즉시 조회해 응답 확인 |

15초마다, 그리고 응답이 올 때마다 갱신합니다. 화면에는 없지만 프롬프트 캐시 만료 5분 전(5분짜리 캐시는 1분 전)에 알림을 한 번 띄웁니다. 엔진이 이미 가진 수치만 읽으므로 **토큰을 쓰지 않습니다**.

### change-tutor — 변경 학습 노트(Change Notes) 패널

**기본값은 꺼짐입니다.** `/config`의 `change-tutor.enabled`로 켜거나, 이번 세션만 `/change-tutor on`으로 켭니다.

Claude가 파일을 만들거나 고칠 때(Edit / Write)마다 노트가 하나씩 쌓입니다. 노트에는 파일과 `+추가 -삭제 · 시각`, **🙋 Request**(그 턴의 요청), **🤔 Why it changed**(변경 직전에 Claude가 한 말), diff가 담깁니다. 노트마다 **💡 Explain simply**(쉬운 설명)과 4지선다 **❓ Quiz**를 요청할 수 있습니다. 메인 에이전트가 고친 것만 노트로 남기고, 서브에이전트가 고친 내역은 agent-flow(`sub_Diff`)에서 봅니다. 노트는 세션이 바뀌어도 남고 최근 100건까지 보관합니다. 상태줄에 `📘 N change notes`가 표시됩니다.

### pinboard — 프롬프트 위 고정 메모

`/pin <메모>`로 프롬프트 바로 위 작은 보드에 메모를 고정합니다. 대화가 아무리 길어져도 밀려나지 않습니다. 메모 앞에 `!`를 붙이면 중요 표시(빨간색, ★)가 되고, `!!`를 붙이면 Claude의 작업을 끊고 바로 읽게 합니다(아래 참고). 줄마다 `[✓]`로 완료 처리(취소선, `[↺]`로 되돌리기)하고, 오른쪽 `[×]`로 지웁니다. 폴더별로 저장되어 같은 폴더에서 새 세션을 열면 그대로 남아 있습니다.

새로 고정한 메모는 **Claude에게 즉시 전달**되고, `/pin`은 Claude가 작업 중이어도 바로 실행됩니다.

- Claude가 쉬고 있을 때: 메모가 사용자 프롬프트(`📌 Pin #1: …`)로 들어가 Claude가 바로 작업을 시작합니다.
- Claude가 작업 중일 때: 메모가 사용자 메시지로 대화에 추가되어 다음 단계(지금 쓰는 응답이나 도구 실행이 끝난 직후)에 읽힙니다. 작업 중에 메시지를 입력해 보낼 때와 같은 시점입니다. 다음 단계 전에 턴이 끝나면 후속 프롬프트(`📌 Pinned while you were working: …`)로 전달됩니다.
- Claude가 작업 중일 때 `/pin !! <메모>`: 진행 중인 턴을 끊고 메모를 바로 프롬프트(`📌 Pin #1 (urgent — I stopped your turn for this): …`)로 보냅니다. 방향을 당장 바꿀 때 씁니다. 쓰던 응답이나 실행 중이던 도구는 중간에 끊기고, Claude는 메모를 읽은 뒤 작업을 이어갑니다.

`pinboard.deliver` = `false`로 끌 수 있습니다.

| 명령 | 동작 |
|---|---|
| `/pin <메모>`, `/pin ! <메모>` | 메모 고정(`!`는 중요) 후 Claude에게 전달 |
| `/pin !! <메모>` | 중요 표시로 고정하고, Claude의 작업을 끊고 바로 전달 |
| `/pin done N`, `/pin undo N` | N번 완료 / 되돌리기 |
| `/pin rm N` | N번 삭제(`[×]`와 같음) |
| `/pin clear` | 완료된 메모 일괄 삭제 |
| `/pin list` | 목록 출력 |
| `/pin` | 보드 접기/펼치기 |

### agent-flow — 메인 에이전트와 서브에이전트를 한 패널에

명령 이름은 my-mods v1.2.0 전까지 `/agent-flow`였습니다. 옛 이름은 v1.3.0(agent-flow 0.5.0)에서 제거되었으니 `/aflow`를 쓰세요.

`/aflow`로 패널을 엽니다(세션이 시작될 때도 자동으로 열리며, `/config`의 `agent-flow.autoOpen`으로 끌 수 있습니다). 세션의 메인 에이전트와 모든 서브에이전트가 보입니다.

```
Agent flow · main + 2 agents · 2 running · 0 waiting
● main  Fable 5.1  running  38.2k tok  ×14  ✎3  [main_Diff] [+]  Agent Fix the parser 41s
├ ● Explore "Summarize src/greet.js"  Haiku 4.5  2s  4.1k tok  ×3  ✎0  [+]
└ ● implementer "Fix the parser"  Fable 5.1  41s  22.7k tok  ×9  ✎2  [sub_Diff] [+]  Bash npm test 3m20s  ⚠ slow 3m20s
▸ unlisted loops (1)
last: implementer · Edit src/parser.ts
```

| 부분 | 의미 |
|---|---|
| `●` | 노랑 작업 중(첫 요청부터 실행이 끝날 때까지, 메인이 메시지로 다시 깨우면 다시 노랑), 초록 완료, 빨강 실패·중단, 회색 대기. 머리줄의 `running`에는 턴 중인 main도 포함 |
| `Explore "Summarize …"` | 서브에이전트 종류와 작업. 다른 에이전트가 띄운 것은 그 아래로 들여씁니다 |
| `Fable 5.1` | 실행 모델. Fable은 별도 주간 한도를 쓰므로 자주색으로 강조 |
| `41s` | 실행 시간 |
| `22.7k tok` | 쓴 토큰(입력·캐시 쓰기·출력, 캐시 읽기 제외) |
| `×9` | 도구 호출 횟수 |
| `✎2` | 만들거나 고친 파일 수 |
| `Bash npm test 38s` | 지금 실행 중인 도구와 경과 시간(여러 개면 `+1`처럼 표시) |
| `⚠ slow 3m20s` | 도구 호출이 기준 시간을 넘음: 일반 60초, Bash·PowerShell 3분. 넘으면 노랑, 3배를 넘으면 빨강. 원래 기다리는 도구(Agent, Monitor, AskUserQuestion 등)는 slow로 치지 않고 흐리게 표시 |
| `thinking 1m10s` | 도구 호출 없이 모델 응답이 15초 이상 진행 중. 오래 생각하는 중이지 멈춘 게 아님 |
| `⚠ silent 2m05s` | 작업 중인 에이전트가 도구 호출도, 진행 중인 모델 응답도 없이 2분이 지남(6분 넘으면 빨강) |
| `[+]` | 모델, 작업 프롬프트 앞부분, 최근 도구 호출 5개와 걸린 시간 펼쳐 보기 |
| `[main_Diff]` / `[sub_Diff]` | 그 에이전트의 수정 내역을 하나씩 보기 |
| `▸ unlisted loops (N)` | 엔진의 에이전트 목록에 없는 루프(워크플로 에이전트, 압축 같은 엔진 내부 작업). 접혀 있고 클릭하면 펼침 |
| `last:` | 마지막으로 일어난 일 |

패널은 이번 세션의 에이전트만 보여 주고, `/aflow stats` 기록은 세션을 넘어 유지됩니다. 엔진이 가진 정보만 읽어서 토큰을 쓰지 않습니다. `/aflow text`는 같은 트리를 텍스트로 출력하고, 패널을 그릴 수 없는 환경(`-p` 실행, 에디터 확장)에서는 `/aflow`가 자동으로 텍스트로 출력합니다.

---

## 2. 설치

### 설치 스크립트 (권장)

릴리스를 받아 압축을 풀고, 그 안의 스크립트를 실행합니다. 비공개 저장소라서 `gh auth login` 또는 `GITHUB_TOKEN`(이 저장소 하나, Contents: Read-only 권한의 fine-grained 토큰)이 필요합니다.

```bash
# macOS / Linux / WSL
gh release download --repo gloriouslegacy/claude-mods --pattern 'my-mods-*.zip' --pattern SHA256SUMS.txt
unzip my-mods-*.zip && sh my-mods/install.sh
```

```powershell
# Windows
gh release download --repo gloriouslegacy/claude-mods --pattern 'my-mods-*.zip' --pattern SHA256SUMS.txt
Expand-Archive my-mods-*.zip -DestinationPath .
powershell -ExecutionPolicy Bypass -File .\my-mods\install.ps1
```

압축을 푼 릴리스 안에서 실행하면 그 번들을 그대로 설치합니다(다운로드·체크섬 단계 없음). 스크립트만 따로 실행하면(`gh` 로그인 또는 `GITHUB_TOKEN` 필요) 최신 릴리스를 받아 `SHA256SUMS.txt`와 대조한 뒤 설치합니다. 플러그인 4개를 user 범위로 설치하고, 파일은 `${CLAUDE_CONFIG_DIR:-~/.claude}/claude-mods`(Windows는 `%USERPROFILE%\.claude\claude-mods`)에 두며, 그 폴더로 `my-mods` marketplace를 등록합니다. WSL은 Windows와 `~/.claude`가 따로이므로 쓰는 환경마다 각각 설치해야 합니다.

릴리스의 `my-mods/` 루트에는 설치기 파일이 네 개 있습니다: `install.sh` + `install-lib.sh`, `install.ps1` + `install-lib.ps1`. 짝을 같은 폴더에 함께 두세요. 진입 파일이 lib를 같은 폴더, 번들, 설치 폴더의 `current` / `previous` 순으로 찾습니다.

**v1.2.x에서 올릴 때:** 기본 설치 폴더가 바뀌었습니다(전에는 Windows `%LOCALAPPDATA%\claude-mods`, 그 외 `~/.local/share/claude-mods`). 새 스크립트로 한 번 설치하면 `my-mods` marketplace가 새 위치로 다시 등록되고 플러그인과 `/config` 값은 유지됩니다. 옛 폴더는 새 위치로 설치한 **뒤에** 손으로 지우세요. 먼저 지우면 marketplace가 끊어집니다. v1.2.x 설치에는 lib 파일이 없어서, 파일 없이 실행하는 `--rollback`·`--uninstall`(`curl | sh`, `irm | iex`)은 v1.3.0을 한 번 설치하거나 압축을 푼 v1.3.0 릴리스 폴더에서 실행해야 합니다.

`~/.claude`를 dotfiles 등으로 PC 간에 동기화하면 설치 폴더(번들)도 함께 딸려 갑니다. marketplace 경로가 절대 경로라 다른 PC에서는 깨지므로, PC마다 설치하고 `claude-mods`는 동기화에서 빼는 것을 권합니다.

| 옵션 (bash / PowerShell) | 동작 |
|---|---|
| `--plugins qhud,pinboard` / `-Plugins qhud,pinboard` | 일부만 설치(기본: 4개 전부) |
| `--version v1.4.0` / `-Version v1.4.0` | 특정 버전 설치(기본: 최신) |
| `--zip <파일>` `--sums <파일>` / `-Zip <파일>` `-Sums <파일>` | 이미 받은 zip으로 설치. `SHA256SUMS.txt`가 zip 옆에 있어야 하며, 다른 위치면 `--sums` 지정 |
| `--dir <경로>` / `-Dir <경로>` | 설치 폴더 변경(홈 폴더·드라이브 루트·Claude 설정 폴더 자체는 거부) |
| `--rollback` / `-Rollback` | 바로 전 설치로 되돌리기 |
| `--uninstall` / `-Uninstall` | 플러그인, marketplace, 설치 폴더 제거. 노트·고정 메모·실행 기록(데이터)은 남고 `/config` 설정값은 지워짐 |
| `--dry-run` / `-DryRun` | 할 일만 출력하고 아무것도 바꾸지 않음 |

### 수동 설치

릴리스 압축을 계속 둘 폴더(예: `C:\Users\<이름>`, `~`)에 풉니다. 맨 위에 `my-mods/` 폴더가 생기며, 아래 명령은 그 `my-mods/` 폴더 안에서 실행합니다.

```bash
claude plugin marketplace add ./
claude plugin install qhud@my-mods --scope user
claude plugin install change-tutor@my-mods --scope user
claude plugin install pinboard@my-mods --scope user
claude plugin install agent-flow@my-mods --scope user
```

- `--scope user`로 설치하면 모든 프로젝트, 터미널, 데스크톱 앱 Code 탭에서 로드됩니다. 필요한 것만 설치해도 됩니다.
- 설치할 때 "option not yet set" 안내가 나와도 기본값으로 동작합니다. 처음부터 지정하려면 qhud 설치에 `--config ttl=1h`(qhud의 키)를, change-tutor 설치에 `--config model=haiku`(change-tutor의 키)를 붙이세요. 예: `claude plugin install change-tutor@my-mods --scope user --config model=haiku`
- 플러그인은 이 폴더에서 바로 읽힙니다. **폴더를 옮기거나 지우지 마세요.** 파일을 고친 뒤에는 `/reload-plugins`를 실행하면 반영됩니다.

다른 로드 방법:

```bash
# 이번 한 세션만
claude --plugin-dir ./qhud --plugin-dir ./change-tutor --plugin-dir ./pinboard --plugin-dir ./agent-flow
```

```json
// ~/.claude/settings.json — 항상 로드(절대 경로, Windows는 ";", macOS·Linux는 ":"로 구분)
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\<이름>\\my-mods\\qhud;C:\\Users\\<이름>\\my-mods\\pinboard" } }
```

업데이트: 설치 스크립트를 같은 명령으로 다시 실행하고 `/reload-plugins`를 실행합니다(새 세션을 열어도 됩니다). `/config`에서 바꾼 설정은 유지됩니다. (수동 설치: 새 버전을 같은 폴더에 덮어 풀고 `claude plugin marketplace update my-mods`와 `/reload-plugins`를 실행합니다.)

**tcw**를 쓰던 버전에서 올리는 경우: 이름이 **qhud**로 바뀌었습니다. [docs/migration/RENAME_TCW_TO_QHUD.md](docs/migration/RENAME_TCW_TO_QHUD.md)를 따라 옮기세요(설정은 `qhud` 항목에 다시 넣어야 합니다).

제거: 스크립트를 `--uninstall`(Windows는 `-Uninstall`)로 실행합니다. (수동 설치: `claude plugin uninstall <이름>@my-mods`)

blast-radius와 replay-theater는 이 묶음에서 빠졌습니다. 예전에 설치했다면 `claude plugin uninstall blast-radius@my-mods`, `claude plugin uninstall replay-theater@my-mods`로 지우세요.

---

## 3. 사용법

### qhud

할 일이 없습니다. 세션을 시작하면 자동으로 표시됩니다. 폴백 체인을 항상 보이게 하려면 `~/.claude/settings.json`에 `{ "fallbackModel": ["sonnet", "haiku"] }`처럼 적어 두세요.

| 설정(`/config`) | 값 | 기본값 |
|---|---|---|
| `qhud.layout` | `bottom`(프롬프트 아래 2줄), `band`(프롬프트 위 2줄), `line`(프롬프트 아래 한 줄) | `bottom` |
| `qhud.style` | `plain`, `chip`(줄마다 음영 배경), `box`(둥근 테두리, 2줄 더 차지). band일 때만 적용 | `plain` |
| `qhud.model` | `true`, `false` — 모델·추론 강도·폴백 체인 표시 여부 | `true` |
| `qhud.weather` | `true`, `false` — `CT 67%`(컨텍스트 사용률) 표시 여부 | `true` |
| `qhud.plan` | `true`, `false` — 모델별 주간 한도 표시 여부(5분마다 조회, 토큰 없음) | `true` |
| `qhud.git` | `true`, `false` — git 상태 표시 여부(갱신마다 `git status` 실행, 토큰 없음) | `true` |
| `qhud.ttl` | `1h`, `5m` — 캐시 만료 알림의 기준 시간 | `1h` |

`/qhud-usage`는 계정 사용량 엔드포인트를 바로 읽어 응답 내용을 출력합니다. 모델별 한도가 이상하거나 보이지 않을 때 쓰세요.

### change-tutor

- 기록이 켜져 있으면 세션의 첫 변경 때 패널이 자동으로 열립니다. 언제든 **`/change-tutor`**로 열 수 있고, 꺼져 있어도 예전 노트는 볼 수 있습니다.
- 단축키는 패널에 포커스가 있을 때 동작합니다(패널 클릭 또는 `ctrl+x tab`).

| 키 | 동작 |
|---|---|
| `h` / `l` | 이전 / 다음 노트 |
| `e` | 💡 Explain simply(쉬운 설명) |
| `q` | ❓ Quiz(이어서 `1`–`4`로 답 선택) |
| `v` | ⤢ Show all / ⤡ Collapse(diff 펼치기/접기) |
| `c` | Copy diff(diff 복사) |

- **This session** / **All notes** 탭과 **Latest**는 버튼으로 누릅니다.
- Explain과 Quiz는 누를 때만 모델을 호출합니다. 그때 토큰이 듭니다.

| 설정(`/config`) | 값 | 기본값 |
|---|---|---|
| `change-tutor.enabled` | `true`, `false` — 메인 에이전트 변경을 노트로 남기고 상태줄에 개수 표시 | `false` |
| `change-tutor.model` | `haiku`, `sonnet`, `opus` | `haiku` |

### pinboard

- **`/pin <메모>`**는 Claude가 작업 중일 때도 언제든 입력할 수 있습니다. `/pin ! <메모>`는 중요 표시, `/pin !! <메모>`는 작업을 끊고 바로 읽게 합니다. 나머지 명령은 1장의 표를 보세요.
- 줄의 `[✓]` / `[↺]` / `[×]`를 클릭하거나, `ctrl+x tab`으로 보드에 포커스를 준 뒤 버튼으로 이동합니다. `[Hide]` / `[Show]`로 보드를 머리줄만 남기고 접습니다.
- 새 메모는 Claude에게 즉시 전달됩니다. 쉬고 있으면 프롬프트로 보내져 바로 작업을 시작하고, 작업 중이면 다음 단계에서 읽힙니다(그 전에 턴이 끝나면 후속 프롬프트로 전달). 완료나 삭제는 전달하지 않습니다.
- 메모는 폴더별로 최근 50개까지 저장되고, 같은 폴더에서 새 세션을 열면 다시 나타납니다.

| 설정(`/config`) | 값 | 기본값 |
|---|---|---|
| `pinboard.deliver` | `true`, `false` — 새 메모를 Claude에게 전달 | `true` |

### agent-flow

- Claude Code를 실행한 뒤 첫 세션이 시작될 때 패널이 한 번 열립니다(설정 `agent-flow.autoOpen`, 기본 켜짐). resume·compact로는 다시 열리지 않고, 이미 열려 있으면 그대로 둡니다. 패널을 그릴 수 없는 환경에서는 `/aflow text`를 쓰라는 토스트가 한 번 나옵니다. 언제든 **`/aflow`**로 열 수 있습니다.
- 줄의 `[+]`를 누르면 모델, 작업 프롬프트, 최근 도구 호출이 펼쳐지고, `▸ unlisted loops`를 누르면 목록에 없는 루프가 펼쳐집니다.
- `[main_Diff]` / `[sub_Diff]`를 클릭하거나, `ctrl+x tab`으로 패널에 포커스를 준 뒤 이동합니다. diff 화면에서 `h` / `l` 이전·다음 변경, `v` 펼치기·접기, `b` 흐름 화면으로 돌아가기.
- 새 세션은 빈 화면에서 시작합니다.
- 서브에이전트 실행이 끝날 때마다 기록합니다(에이전트, 모델, 토큰, 시간, 호출 수, 수정 수. 세션을 넘어 최근 3000건). **`/aflow stats [일수]`**로 많이 쓴 순서대로 합산해 봅니다.

```
Subagent runs, last 7 days: 42 runs, 1.85M tokens (cache reads left out)
agent        model      runs    tokens  share  tok/run  time/run  calls  edits
implementer  Fable 5.1    12    980.0k    53%    81.7k     1m46s    180     41
reviewer     Sonnet 5.5   15    610.0k    33%    40.7k       28s     90      0
runner       Haiku 5.5    15    260.0k    14%    17.3k       43s    120      0
```

어떤 에이전트를 더 싼 모델로 내릴지 정할 때 씁니다.

| 설정(`/config`) | 값 | 기본값 |
|---|---|---|
| `agent-flow.slowSeconds` | 도구 호출을 ⚠ slow로 표시할 초 | `60` |
| `agent-flow.slowShellSeconds` | Bash·PowerShell용 같은 기준 | `180` |
| `agent-flow.silentSeconds` | 작업 중 에이전트를 ⚠ silent로 표시할 초 | `120` |
| `agent-flow.autoOpen` | `true`, `false` — 세션 시작 때 패널 열기(Claude Code 실행당 한 번) | `true` |
| `agent-flow.log` | `true`, `false` — 서브에이전트 실행 기록(stats용) | `true` |

---

## 확인

```bash
claude plugin validate ./<모드>
claude plugin test ./<모드>
```
