# change-tutor removed in v2.0.0

> For: anyone who installed `change-tutor`.
> Applies to: my-mods v2.0.0 and later.

## English

**What changed:** the `change-tutor` plugin was removed in v2.0.0. There is no replacement. qhud, pinboard and agent-flow are unchanged, and so are their data and `/config` settings.

**What you see after updating:** the marketplace update succeeds, but the installed change-tutor is not removed automatically. `/plugin` (and `claude plugin list`) shows it as:

```
failed to load — Plugin change-tutor not found in marketplace my-mods
```

`claude plugin update` also exits with an error for it. This is harmless but stays until you remove it.

**If you used the install script:** it detects an installed change-tutor and prints the removal command below. It does not remove anything itself.

**Remove it:**

```bash
claude plugin uninstall change-tutor@my-mods --scope user
```

Then run `/reload-plugins` (or start a new session).

**Warning:** removing change-tutor deletes its saved learning notes (the latest 100) and its `/config` values (`enabled`, `model`). There is no way to get them back, so copy anything you want to keep first.

---

## 한국어

**무엇이 바뀌나:** v2.0.0에서 `change-tutor` 플러그인을 제거했다. 대체 기능은 없다. qhud, pinboard, agent-flow와 그 데이터, `/config` 설정은 그대로다.

**업데이트 뒤 증상:** marketplace 업데이트는 성공하지만 설치돼 있던 change-tutor는 자동으로 지워지지 않는다. `/plugin`(또는 `claude plugin list`) 목록에 아래처럼 남는다.

```
failed to load — Plugin change-tutor not found in marketplace my-mods
```

`claude plugin update`도 이 플러그인에서는 오류로 끝난다. 동작에 해는 없지만 지우기 전까지 남는다.

**설치 스크립트를 쓴 경우:** change-tutor가 설치돼 있으면 스크립트가 아래 제거 명령을 안내한다. 스크립트가 직접 지우지는 않는다.

**제거 방법:**

```bash
claude plugin uninstall change-tutor@my-mods --scope user
```

그다음 `/reload-plugins`를 실행하거나 새 세션을 연다.

**경고:** change-tutor를 제거하면 저장된 학습 노트(최근 100건)와 `/config`의 `enabled`·`model` 값이 사라진다. 되돌릴 수 없으니 남기고 싶은 내용은 먼저 복사해 둔다.
