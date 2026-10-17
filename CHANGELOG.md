# Changelog

Newest first. Each release is one `## vX.Y.Z (date)` section; the release workflow publishes that section as the release notes.

## v1.1.0 (2026-10-17)

- **Renamed: tcw → qhud 0.17.0** (folder `token-cache-weather/` → `qhud/`). What it shows is unchanged.
  - Settings are not carried over: the keys move from `tcw.*` to `qhud.*`. Note your values in `/config` before updating and set them again under `qhud`.
  - `/tcw-usage` is now `/qhud-usage`; the old name still answers in v1.1.x and goes in v1.2.0.
  - Already installed? Follow `docs/migration/RENAME_TCW_TO_QHUD.md` (uninstall `tcw@my-mods`, install `qhud@my-mods`).
- **change-tutor 0.4.0: off by default.** Nothing is noted and no status line shows until `change-tutor.enabled` is turned on in `/config`, or for one session with `/change-tutor on` (`/change-tutor off` stops it). Notes kept before stay readable with `/change-tutor`.

## v1.0.0 (2026-10-17)

First release from this repository.

- **tcw 0.16.2**: two lines under the prompt (model, effort, git, context fill; 5-hour, weekly and model-specific weekly limits). `/tcw-usage`.
- **change-tutor 0.3.0**: learning notes for the main agent's changes; subagents' changes moved to agent-flow.
- **pinboard 0.3.0**: `/pin` notes above the prompt, sent to Claude at once; `/pin !!` stops the running turn and sends the note now.
- **agent-flow 0.3.0**: `/agent-flow` pane for main and subagents (model, tokens, calls, current tool, slow / thinking / silent signs, `[+]` details, unlisted loops, main_Diff / sub_Diff); `/agent-flow stats` over logged runs.
- Removed from the set: blast-radius, replay-theater (`claude plugin uninstall <name>@my-mods` on machines that have them).
