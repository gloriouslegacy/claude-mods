# my-mods 배포 체계 인수인계서

> 대상: 이 저장소를 이어받는 개발자
> 범위: GitHub 비공개 저장소에서 릴리스를 만들고, 사용자가 받은 뒤 스크립트 하나로 Windows, Windows WSL, Linux, macOS에 설치하는 구조
> 상태: 설계 문서(초안). 스크립트와 워크플로는 이 문서를 기준으로 작성하며, 아래 "검증 필요" 표시가 붙은 항목은 실제 환경에서 확인한 뒤 표시를 지운다.
> 주의: 설치 스크립트가 생기기 전 릴리스는 README 의 수동 설치(marketplace add + plugin install)로 설치한다. 그 동안 release 워크플로는 스크립트가 없으면 경고만 내고, zip 에는 있으면 넣는다.
> 작성: 2026-10-17

---

## 1. 무엇을 배포하나

Claude Code mod(함수 훅 플러그인) 4개를 하나의 marketplace(`my-mods`)로 묶어 배포한다.

| 플러그인 | 폴더 | 현재 버전 | 하는 일 |
|---|---|---|---|
| qhud (이전 tcw) | `qhud/` | 0.17.0 | 프롬프트 위·아래 상태 줄: 모델·effort·fallback, git, 컨텍스트 사용률, 5시간/주간/모델별 주간 한도, 캐시 만료 경고 |
| change-tutor | `change-tutor/` | 0.4.0 | 메인 에이전트가 고친 파일마다 학습 노트(쉬운 설명·퀴즈). 기본 꺼짐 |
| pinboard | `pinboard/` | 0.3.0 | `/pin` 고정 메모, 작업 중인 Claude에게 즉시 전달, `!!`로 작업 중단 후 전달 |
| agent-flow | `agent-flow/` | 0.3.0 | `/agent-flow` 패널: 메인·서브에이전트 상태, 모델, 토큰, 멈춤 경고, diff, 실행 통계 |

요구 사항: Claude Code 2.1.287 이상, 함수 훅(hooks module)을 쓸 수 있는 환경. 함수 훅은 아직 초기 기능이라 버전에 따라 API가 바뀔 수 있다(9장 참고).

---

## 2. 배포 방식 개요

배포 경로를 두 가지로 둔다. 둘 다 같은 저장소, 같은 태그에서 나온다.

| 경로 | 대상 | 방법 | 장점 | 단점 |
|---|---|---|---|---|
| A. 릴리스 zip + 설치 스크립트 (기본) | 일반 사용자, 새 PC | GitHub Release에서 zip을 받아 `install.sh` / `install.ps1` 실행 | git 없이도 설치, 버전 고정, 체크섬 검증 | 업데이트 때 스크립트를 다시 실행 |
| B. Git marketplace (개발자용) | 관리자 본인, 개발 PC | `claude plugin marketplace add <owner>/<repo>` | `claude plugin marketplace update my-mods` 한 번으로 갱신 | 비공개 저장소라 git 인증 필요, 항상 기본 브랜치 최신을 따라감 |

일반 사용자는 A만 안내한다. B는 개발 중인 코드가 곧바로 설치되므로 관리자 PC에서만 쓴다.

---

## 3. 저장소 폴더/파일 구조

`[있음]` 은 지금 저장소에 있는 것, `[계획]` 은 아직 없고 이 문서가 사양인 것이다.

```
claude-mods/                          ← 저장소 루트
├── .claude/CLAUDE.md                 ← Claude Code 작업 안내(zip 제외)
├── .claude-plugin/
│   └── marketplace.json              ← marketplace 정의(이름 my-mods, 플러그인 4개와 각 버전)
├── qhud/                             ← 이전 이름 tcw(token-cache-weather/), 옮기는 법은 docs/migration/RENAME_TCW_TO_QHUD.md
│   ├── .claude-plugin/plugin.json    ← 이름·버전·설명·userConfig
│   ├── hooks/
│   │   ├── hooks.json                ← { "modules": ["./register.tsx"] }
│   │   ├── register.tsx              ← 훅 진입점
│   │   └── *.ts                      ← 순수 함수(표시 문구, 계산)
│   ├── types/index.d.ts              ← 도메인 타입 + 호스트 API(`claude-code`) ambient 선언(손으로 씀)
│   ├── tests/<mod>.test.tsx          ← claude plugin test 대상(한 장)
│   └── CLAUDE.md                     ← Claude Code 작업 안내(zip 제외)
├── change-tutor/                     ← 같은 구조
├── pinboard/                         ← 같은 구조
├── agent-flow/                       ← 같은 구조
├── scripts/
│   ├── CLAUDE.md                     ← [있음] Claude Code 작업 안내(zip 제외)
│   ├── check.sh                      ← [있음] 이름·버전 일치 + 복사본 3쌍 본문 비교(목록은 docs/structure.md) + validate/test
│   ├── install.sh                    ← [계획] Linux / macOS / WSL 설치·업데이트·제거
│   ├── install.ps1                   ← [계획] Windows(PowerShell 5.1 / 7) 설치·업데이트·제거
│   └── bump-version.mjs              ← [계획] plugin.json과 marketplace.json의 버전을 함께 올림
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    ← PR·push 때 validate/test, 스크립트 정적 검사
│   │   └── release.yml               ← v* 태그 push 때 zip·체크섬 만들고 Release 게시
│   ├── dependabot.yml                ← 액션 버전 월 1회 갱신
│   └── pull_request_template.md
├── docs/
│   ├── release/RELEASE.md            ← 이 문서
│   ├── migration/RENAME_TCW_TO_QHUD.md ← tcw → qhud 이름 변경 안내
│   ├── design/baseline.md            ← 구조 기준선(기존 docs/decisions/ 대체)
│   ├── structure.md                  ← 모듈·복사본·의존 구조
│   ├── mem.md                        ← 세션 메모
│   └── map.md                        ← 자동 생성(gitignore)
├── .gitattributes                    ← 줄바꿈 고정(6장)
├── .gitignore
├── CHANGELOG.md                      ← 릴리스마다 플러그인별 변경
├── VERSION                           ← 묶음(번들) 버전, 예: 1.4.0
├── README.md                         ← 사용자 안내(영문)
└── README.ko.md                      ← 사용자 안내(한국어)
```

**릴리스 zip 안의 구조**(사용자가 받는 것):

```
my-mods-v1.4.0.zip
└── my-mods/
    ├── .claude-plugin/marketplace.json
    ├── qhud/
    ├── change-tutor/
    ├── pinboard/
    ├── agent-flow/
    ├── install.sh             [계획] 스크립트가 생기면 넣는다(없으면 경고만)
    ├── install.ps1            [계획] 위와 같음
    ├── docs/migration/        README 가 링크하는 이전 안내(같은 상대 경로)
    ├── VERSION
    ├── README.md
    ├── README.ko.md
    └── CHANGELOG.md
```

플러그인 4개 모두에서 `*/tests`, `*/.claude-plugin/types`(엔진이 만드는 파일), `*/node_modules`, `*/CLAUDE.md`, `*/CLAUDE.local.md`를 뺀다(release.yml의 `tar --exclude`). `.github/`, `.claude/`, `scripts/check.sh`, `scripts/bump-version.mjs`도 zip에 없다. `docs/` 중 `migration/`만 zip에 들어간다.

**설치 후 사용자 PC의 위치:**

| 환경 | 설치 폴더 | 비고 |
|---|---|---|
| Windows | `%LOCALAPPDATA%\claude-mods\` | OneDrive 동기화 대상인 문서 폴더를 피한다 |
| macOS / Linux / WSL | `~/.local/share/claude-mods/` | `XDG_DATA_HOME`이 있으면 그 아래 |

설치 폴더 안에는 `current/`(사용 중인 버전)와 `previous/`(바로 전 버전, 되돌리기용)만 둔다. marketplace는 항상 `current/`를 가리킨다. 플러그인은 이 폴더에서 바로 읽히므로 폴더를 옮기거나 지우면 동작하지 않는다. **검증 필요**: Claude Code 가 로컬 marketplace 플러그인을 캐시로 복사하는지(복사하면 업데이트 때 `claude plugin update`가 필요하다).

---

## 4. GitHub 설정

### 4.1 저장소

| 항목 | 값 | 이유 |
|---|---|---|
| 공개 범위 | Private | 개인 도구. 공개로 바꿀 때는 9.8 참고 |
| 기본 브랜치 | `main` | |
| Merge 방식 | Squash merge만 허용 | 커밋 기록을 릴리스 단위로 깔끔하게 |
| Automatically delete head branches | On | |
| Issues | On | 버그·요청 기록 |
| Wiki / Projects | Off | 문서는 `docs/`에 둔다 |

### 4.2 브랜치 보호(`main`)

Settings → Rules → Rulesets에서 `main` 대상 규칙을 만든다.

- Require a pull request before merging (혼자 관리하면 승인 수 0, 협업이면 1)
- Require status checks to pass: `check` (ci.yml의 잡 id, 4.4의 CI)
- Block force pushes, Restrict deletions

### 4.3 태그 보호

Rulesets에서 태그 패턴 `v*` 대상 규칙을 만든다: 삭제 금지, 덮어쓰기(force push) 금지. 한 번 배포한 태그를 다시 찍지 않는다. 고칠 게 생기면 다음 패치 버전으로 낸다. 사전 릴리스(`-rc.N`) 태그도 지우지 않는다. 시험은 `v<VERSION>-rc.N`으로 하고 N 을 올려 간다.

태그 push 뒤 워크플로가 실패하면:
- 코드 변경 없이 될 일(러너 일시 오류, 변수 설정 등)이면 Actions 에서 **Re-run jobs**.
- 코드·VERSION·CHANGELOG 를 고쳐야 하면 다음 patch(VERSION·CHANGELOG 포함)로 새 태그를 낸다.
- 실패한 태그는 지우지 않고 남긴다.

### 4.4 Actions

- Settings → Actions → General → Workflow permissions: **Read repository contents** 기본, 릴리스 워크플로에서만 `permissions: contents: write`를 지정한다.
- 비밀값(Secrets)은 필요 없다. 릴리스 게시는 기본 제공 `GITHUB_TOKEN`으로 충분하다.
- CI에 Claude Code CLI가 필요하다: `npm install -g @anthropic-ai/claude-code`. `claude plugin validate`와 `claude plugin test`가 로그인 없이 도는지는 **검증 필요**. 로그인이 필요하면 저장소 변수(Settings → Secrets and variables → Actions → Variables) `SKIP_PLUGIN_TESTS=true`를 만든다. 그러면 CI와 릴리스는 validate만 하고, 테스트는 태그 전에 로컬에서 돌린다. 이는 `bash scripts/check.sh --no-test`와 같은 효과다(`check.sh`가 두 방법을 모두 인식한다).

워크플로 파일(저장소에 포함):

| 파일 | 언제 | 하는 일 |
|---|---|---|
| `.github/workflows/ci.yml` | PR, `main` push, 매주 월요일 09:17 KST, 수동 | `check` 잡: Claude Code 최신판 설치 → `scripts/check.sh`(이름·버전 일치 + 복사본 3쌍 본문 비교(목록은 `docs/structure.md`) + 플러그인 4개 validate·test) → `VERSION`과 `CHANGELOG.md` 단락 확인. `scripts` 잡: 설치 스크립트가 생기면 Ubuntu·macOS·Windows에서 정적 검사와 `--dry-run`(PowerShell 7과 5.1 둘 다). `report` 잡: 주간 실행이 실패하면 이슈를 하나 열고, 이미 열려 있으면 댓글을 단다 |
| `.github/workflows/release.yml` | `v*` 태그 push | `check.sh` → 태그·`VERSION`·`CHANGELOG` 일치 확인 → 설치 스크립트 존재 확인(없으면 경고만) → zip 생성(제외 목록은 3장, 설치 스크립트는 있으면 넣고 `docs/migration/`도 넣는다) → `SHA256SUMS.txt` → Release 게시(노트는 해당 CHANGELOG 단락, `-rc.N` 같은 태그는 사전 릴리스) |
| `.github/dependabot.yml` | 매월 | 워크플로가 쓰는 액션 버전 갱신 PR |
| `.github/pull_request_template.md` | PR 작성 시 | 버전·CHANGELOG·README 두 벌 체크리스트 |

- `ci.yml`의 `check` 잡 id가 4.2에서 요구하는 상태 검사(`check`)다.
- `release.yml`은 `scripts/install.sh`와 `scripts/install.ps1`이 없으면 경고만 내고 계속한다. 그 릴리스는 README 의 수동 설치(marketplace add + plugin install)로 설치한다. 스크립트가 있으면 zip 에 넣는다.
- 첫 태그 절차: `v1.1.0-rc.1`(사전 릴리스)로 워크플로를 점검한 뒤 `v1.1.0`. v1.0.0 은 태그 없이 CHANGELOG 에만 남는다.
- 로컬 검증: 두 워크플로 모두 actionlint 1.7.7 통과, zip 생성 단계는 로컬에서 같은 명령으로 재현해 제외 규칙을 확인했다. 실제 GitHub 러너 실행은 **검증 필요**(10장 체크리스트의 사전 릴리스 태그로 확인).

### 4.5 사용자가 비공개 저장소에서 릴리스를 받는 방법

비공개 저장소의 Release 파일은 로그인 없이 받을 수 없다. 방법을 우선순위대로 둔다.

1. **GitHub CLI(`gh`)가 있으면**: `gh auth login` 후 설치 스크립트가 `gh release download`로 받는다. 가장 간단하다.
2. **`gh`가 없으면**: Fine-grained Personal Access Token을 만든다. 범위는 이 저장소 하나, 권한은 Contents: Read-only, 만료는 90일 이내. 스크립트는 환경변수 `GITHUB_TOKEN`으로 받아 GitHub API로 내려받는다. 토큰을 스크립트나 파일에 적어 두지 않는다.
3. **웹에서 직접 받은 zip**: 사용자가 브라우저로 Release에서 zip을 받았다면 `install.sh --zip <파일>` / `install.ps1 -Zip <파일>`로 다운로드 단계를 건너뛴다. 이때 같은 폴더의 `SHA256SUMS.txt`를 요구하고 없으면 중단한다(다른 위치면 `--sums <파일>` / `-Sums <파일>`).

---

## 5. 릴리스 절차(관리자)

1. 기능 브랜치에서 작업 → PR → CI 통과 → squash merge
2. 버전 올리기: `node scripts/bump-version.mjs agent-flow minor`(계획)
   - 해당 플러그인의 `plugin.json`과 `marketplace.json`의 같은 항목을 함께 올린다. 두 파일의 버전이 어긋나면 marketplace 갱신이 안 먹는다. `bump-version.mjs`가 생기기 전에는 두 파일을 손으로 함께 올린다.
   - `bump-version.mjs`는 이 두 파일만 올린다. 묶음 버전 `VERSION`은 릴리스 때 한 번 정한다(규칙은 7장 표).
3. `CHANGELOG.md` 맨 위에 `## v1.4.0 (2026-10-20)` 단락을 쓰고 플러그인별 변경을 적는다. 릴리스 노트로 그대로 쓰인다. CI 는 `## v<VERSION>` 단락의 존재만 확인한다(맨 위인지는 보지 않는다).
4. 로컬에서 `bash scripts/check.sh` 통과 확인
5. `git tag v1.4.0 && git push origin v1.4.0` → release 워크플로가 zip과 `SHA256SUMS.txt`를 게시
6. 최소 한 PC에서 `install.sh` / `install.ps1`로 새 버전을 설치하고, 4개 플러그인이 로드되는지 확인(`/plugin` 목록, `/agent-flow`, `/pin list`)

---

## 6. 설치 스크립트 사양

### 6.1 공통 동작

| 단계 | 내용 |
|---|---|
| 1. 사전 확인 | `claude` 명령이 있는지, `claude --version`이 2.1.287 이상인지. 없거나 낮으면 이유를 말하고 중단 |
| 2. 받기 | 기본은 최신 Release. `--version v1.4.0`으로 특정 버전. 4.5의 순서(gh → 토큰 → `--zip`). 스크립트 옆에 번들(`.claude-plugin/marketplace.json`)이 있으면(압축 푼 zip 안에서 실행) 그 번들을 설치하고 받기·3단계를 생략한다 |
| 3. 검증 | `SHA256SUMS.txt`와 zip 해시 비교. 다르면 중단. `--zip`은 같은 폴더의 `SHA256SUMS.txt`(또는 `--sums <파일>`)가 없으면 중단 |
| 4. 풀기 | 임시 폴더에 풀고 구조(`my-mods/.claude-plugin/marketplace.json`) 확인 |
| 5. 교체 | `current/` → `previous/`로 옮기고 새 버전을 `current/`로. 실패하면 `previous/`를 되돌린다 |
| 6. 등록 | marketplace `my-mods`가 없으면 `claude plugin marketplace add <설치폴더>/current`. 있으면 등록 경로를 비교해 `<설치폴더>/current`와 다르면(README 방식 수동 등록 사용자) `remove` 후 `<설치폴더>/current`로 다시 add, 같으면 `claude plugin marketplace update my-mods` |
| 7. 설치 | `tcw@my-mods`가 있으면 제거한 뒤 qhud 를 설치한다(`docs/migration/RENAME_TCW_TO_QHUD.md`가 약속한 내용). 선택한 플러그인마다 `claude plugin install <이름>@my-mods --scope user`(이미 있으면 건너뜀. **검증 필요**: 로컬 marketplace 플러그인이 캐시로 복사되면 건너뛰지 말고 `claude plugin update`가 필요하다) |
| 8. 안내 | 실행 중인 Claude Code 세션에서는 `/reload-plugins`, 또는 새 세션을 열라고 출력. 끝에 한 줄로 "현재 vX, 최신 vY"를 출력 |

### 6.2 옵션

| bash | PowerShell | 의미 |
|---|---|---|
| `--version v1.4.0` | `-Version v1.4.0` | 특정 버전 설치(기본: 최신) |
| `--plugins qhud,pinboard` | `-Plugins qhud,pinboard` | 일부만 설치(기본: 4개 전부) |
| `--zip ./my-mods-v1.4.0.zip` | `-Zip .\my-mods-v1.4.0.zip` | 이미 받은 zip으로 설치(같은 폴더의 `SHA256SUMS.txt` 필요) |
| `--sums <파일>` | `-Sums <파일>` | `SHA256SUMS.txt`가 zip 과 다른 위치일 때 |
| `--dir <경로>` | `-Dir <경로>` | 설치 폴더 변경 |
| `--rollback` | `-Rollback` | `previous/`로 되돌리기 |
| `--uninstall` | `-Uninstall` | 4개 플러그인과 marketplace 제거, 설치 폴더 삭제 |
| `--dry-run` | `-DryRun` | 할 일만 출력하고 아무것도 바꾸지 않음(CI용) |

### 6.3 OS별 주의점

**Windows (PowerShell)**
- PowerShell 5.1과 7 모두에서 돌아야 한다. 5.1에서는 다운로드 전에 `[Net.ServicePointManager]::SecurityProtocol = 'Tls12'`가 필요하다.
- 실행 정책 때문에 바로 실행이 막힐 수 있다. 안내 문구: `powershell -ExecutionPolicy Bypass -File .\install.ps1`. 시스템 설정은 바꾸지 않는다.
- 인터넷에서 받은 파일은 차단 표시가 붙는다. 스크립트가 zip을 직접 받은 경우 `Unblock-File`을 적용한다.
- 압축 풀기는 `Expand-Archive`, 해시는 `Get-FileHash -Algorithm SHA256`.
- 사용자 이름에 한글이나 공백이 있는 경로를 반드시 시험한다(예: `C:\Users\홍 길동\`). 모든 경로를 따옴표로 감싼다.
- 심볼릭 링크는 관리자 권한이나 개발자 모드가 필요하므로 쓰지 않는다. `current/`는 실제 폴더로 두고 이름 바꾸기로 교체한다.
- 이 저장소 관리자는 Windows Terminal에서 pwsh를 쓴다. 기본 시험 환경으로 삼는다.

**Windows WSL**
- WSL 안에서 실행하는 Claude Code는 Windows 쪽과 **설정 폴더(`~/.claude`)가 완전히 따로**다. Windows에 설치했다고 WSL에서 보이지 않는다. Claude Code를 쓰는 환경마다 각각 설치해야 한다.
- WSL에서는 `install.sh`를 쓴다. 설치 폴더는 리눅스 쪽(`~/.local/share/claude-mods`)에 둔다. `/mnt/c/...` 아래에 두면 파일 접근이 느리고 권한이 꼬인다.
- Windows에서 받은 zip을 쓸 때만 `--zip /mnt/c/Users/<이름>/Downloads/my-mods-v1.4.0.zip`처럼 경로를 넘긴다.
- 스크립트는 `/proc/version`에 `microsoft`가 있으면 WSL로 판단하고, 위 내용을 한 줄로 안내한다.

**Linux**
- 필요한 명령: `curl`(또는 `wget`), `unzip`, `sha256sum`. 없으면 설치 방법을 안내하고 중단한다.
- `XDG_DATA_HOME`을 따른다.

**macOS**
- 기본 bash가 3.2다. 연관 배열, `${var,,}`, `mapfile` 같은 bash 4 기능을 쓰지 않는다. 가능하면 `#!/bin/sh` 수준으로 쓰고 `shellcheck --shell=sh`를 통과시킨다.
- 해시는 `sha256sum`이 없으므로 `shasum -a 256`을 쓴다(스크립트에서 둘 중 있는 것을 고른다).
- 다운로드한 스크립트에 격리 속성이 붙으면 실행이 막힐 수 있다. 안내 문구: `xattr -d com.apple.quarantine install.sh`.

### 6.4 줄바꿈과 실행 권한

`.gitattributes`:

```
*.sh   text eol=lf
*.ps1  text eol=crlf
*.ts   text eol=lf
*.tsx  text eol=lf
*.json text eol=lf
*.md   text eol=lf
*.yml  text eol=lf
```

`install.sh`는 `git update-index --chmod=+x scripts/install.sh`로 실행 권한을 커밋한다. zip으로 풀면 권한이 빠질 수 있으므로 안내는 `sh install.sh`로 한다.

### 6.5 사용자 안내 문구(README 설치 절)

```bash
# macOS / Linux / WSL
gh release download --repo <owner>/claude-mods --pattern 'my-mods-*.zip' --pattern SHA256SUMS.txt
unzip my-mods-*.zip && sh my-mods/install.sh
```

```powershell
# Windows
gh release download --repo <owner>/claude-mods --pattern 'my-mods-*.zip' --pattern SHA256SUMS.txt
Expand-Archive my-mods-*.zip -DestinationPath .
powershell -ExecutionPolicy Bypass -File .\my-mods\install.ps1
```

---

## 7. 버전 규칙

- 플러그인마다 semver를 따로 둔다(`plugin.json`). 사용자 화면이나 설정(userConfig) 키가 바뀌면 minor, 내부 수정은 patch.
- 묶음 버전(`VERSION`, 태그 `vX.Y.Z`)은 릴리스 단위다. 릴리스에 들어가는 변경 중 가장 큰 것 하나로 정한다(여러 플러그인이면 가장 큰 것).

| 변경 | 번들 버전 |
|---|---|
| 플러그인 major, 플러그인 제거 | major |
| 플러그인 minor | minor |
| 플러그인 patch, 설치기, 문서만 | patch |

- `marketplace.json`의 각 플러그인 버전은 해당 `plugin.json`과 항상 같아야 한다. `scripts/check.sh`가 이 일치를 검사한다.
- userConfig 키 이름을 바꾸거나 지우면 사용자가 `/config`에서 바꾼 값이 사라진다. 바꿀 때는 CHANGELOG에 "설정 이름 변경"을 분명히 적는다.

---

## 8. 사용자 데이터와 업데이트

재설치와 업데이트로 지워지면 안 되는 것:

| 데이터 | 플러그인 | 저장 위치 | 업데이트 시 |
|---|---|---|---|
| 학습 노트(최근 100건) | change-tutor | 플러그인 저장소(`$.store`, Claude 설정 폴더 아래) | 유지 |
| 고정 메모(폴더별 50개) | pinboard | 같음 | 유지 |
| 서브에이전트 실행 기록(최근 3000건) | agent-flow | 같음 | 유지 |
| `/config` 설정값 | 4개 전부 | Claude 설정(settings) | 유지 |

이 데이터는 플러그인 폴더가 아니라 Claude Code 설정 폴더 쪽에 있어서 `current/` 교체로는 지워지지 않는다. 실제 경로와, 플러그인 제거 후 재설치 시에도 남는지는 **검증 필요**. `--uninstall`은 기본적으로 이 데이터를 남기고, 지우는 옵션은 따로 두지 않는다(실수 방지).

---

## 9. 추가로 고려할 사항

### 9.1 Claude Code 업데이트에 따른 깨짐
함수 훅은 초기 기능이라 Claude Code가 올라가면서 API가 바뀔 수 있다. 실제로 이 작업 중에도 2.1.295 → 2.1.301로 올라갔다.
- CI를 주 1회 예약 실행(`schedule: cron`)해서, 최신 Claude Code로 validate/test가 깨지는지 미리 본다.
- 깨지면 README 맨 위에 "확인된 최대 버전"을 적는다.
- 각 플러그인 폴더의 `.claude-plugin/types/`는 엔진이 만들어 주는 파일이다. 저장소에 넣지 않는다(`.gitignore`).

### 9.2 비공개 API 의존(qhud)
qhud의 모델별 주간 한도는 공식 문서에 없는 계정 사용량 엔드포인트(`/api/oauth/usage`)를 읽는다. 응답 형식이 바뀌면 그 항목만 사라지고 나머지는 그대로 보인다. 문제가 생기면 `/qhud-usage`로 실제 응답을 확인하고 `qhud/hooks/plan.ts`를 고친다.

### 9.3 여러 환경 사이의 버전 어긋남
관리자는 PC 2대와 WSL을 쓴다. 설치 스크립트 마지막에 설치된 묶음 버전을 출력하고, `install.sh --version` 없이 실행하면 설치 끝에 "현재 vX, 최신 vY"를 한 줄로 보여 주어 어긋남을 바로 알게 한다. 스크립트 옆에 번들이 있으면(압축 푼 zip 안에서 실행) 그 번들을 설치하고 받기를 생략한다.

### 9.4 되돌리기
새 버전이 문제를 일으키면 `--rollback`으로 바로 전 버전으로 돌아간다. 더 이전 버전이 필요하면 `--version v1.3.0`으로 재설치한다. 태그를 지우거나 다시 찍지 않는다(4.3).

### 9.5 보안
- 설치 스크립트는 체크섬 검증 없이 설치하지 않는다. `--zip`도 같은 폴더의 `SHA256SUMS.txt`(또는 `--sums`)가 없으면 중단한다.
- 토큰은 환경변수로만 받고, 로그에 출력하지 않는다.
- `curl | sh` 형태의 한 줄 설치는 안내하지 않는다. 받은 파일을 열어 보고 실행하게 한다.
- pinboard는 사용자가 쓴 메모를 대화에 그대로 넣는다. 공용 PC에서 쓰는 경우 메모에 비밀값을 적지 않도록 README에 한 줄 적어 둔다.

### 9.6 프록시와 회사망
회사망에서는 GitHub 다운로드가 프록시를 거친다. bash 스크립트는 `HTTPS_PROXY`를 존중하는 `curl` 기본 동작을 쓰고, PowerShell은 시스템 프록시를 쓴다. 다운로드가 막히는 환경을 위해 `--zip` 경로를 늘 열어 둔다.

### 9.7 테스트 매트릭스
릴리스 전 최소 한 번씩:

| 환경 | 확인 |
|---|---|
| Windows 11 + pwsh 7 | 새 설치, 업데이트, 되돌리기, 한글 사용자 경로 |
| Windows + PowerShell 5.1 | 새 설치 |
| WSL (Ubuntu) | 새 설치, Windows 쪽과 따로 동작하는지 |
| macOS (기본 bash 3.2) | 새 설치 |
| Linux | 새 설치 |

### 9.8 공개 저장소로 바꿀 경우
- 4.5의 인증 단계가 필요 없어지고 `curl`로 바로 받을 수 있다.
- 공개 전에 저장소 기록 전체에서 개인 경로, 계정 이메일, 세션 URL을 찾아 지운다(`git log -p`로 확인). 지금 README 예시에 개인 폴더 이름이 들어간 곳이 있는지 점검한다.
- 라이선스 파일(`LICENSE`)을 넣는다.

### 9.9 문서 두 벌 유지
README는 영문과 한국어 두 벌이다. 화면에 보이는 문구는 영문으로 통일했으므로, 기능을 바꾸면 두 README의 예시 화면을 함께 고친다. PR 템플릿에 "README.md / README.ko.md 둘 다 반영했나" 체크 항목을 둔다.

### 9.10 이전 버전 사용자 정리
blast-radius와 replay-theater는 이 묶음에서 빠졌다. 예전에 설치한 PC에는 남아 있을 수 있으므로, 설치 스크립트가 이 둘이 설치돼 있으면 제거 명령을 안내한다(자동 삭제는 하지 않는다).

옛 이름 `tcw@my-mods`는 6.1의 7단계에서 제거 후 qhud 를 설치한다. 일정: my-mods v1.2.0 에서 `/tcw-usage`를 제거한다.

---

## 10. 인수인계 체크리스트

- [ ] 저장소 접근 권한(Admin) 이전
- [ ] 4장의 브랜치·태그 규칙이 켜져 있는지 확인
- [ ] 로컬에서 `bash scripts/check.sh` 통과
- [ ] 사전 릴리스 태그(`v<VERSION>-rc.N`, 예: `v1.1.0-rc.1`)로 release 워크플로를 한 번 돌려 zip·체크섬 게시 확인(태그는 지우지 않는다, 4.3)
- [ ] 9.7 매트릭스 중 최소 Windows와 WSL에서 설치 확인
- [ ] "검증 필요" 표시 항목(4.4 CI 로그인, 8장 데이터 위치) 확인 후 이 문서 갱신
- [ ] Claude Code 가 로컬 marketplace 플러그인을 캐시로 복사하는지 확인(3장, 6.1 7단계). 복사하면 업데이트 절차에 `claude plugin update`를 넣는다
- [ ] Claude Code 최신 버전에서 4개 플러그인 로드 확인
