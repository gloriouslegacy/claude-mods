# Changelog

Newest first. Each release is one `## vX.Y.Z (date)` section; the release workflow publishes that section as the release notes.

## v1.3.0 (2026-10-17)

- **agent-flow 0.5.0: the old `/agent-flow` command is removed**, as announced in v1.2.0. Use `/aflow` (`/aflow text`, `/aflow stats [days]`). Settings (`agent-flow.*`) and logged runs are unchanged.
- **Install scripts split in two.** The release zip now carries four files at the top of `my-mods/`: `install.sh` + `install-lib.sh` and `install.ps1` + `install-lib.ps1`. Keep each pair together. Options, output and behavior are unchanged.
- **The default install folder moved** to `${CLAUDE_CONFIG_DIR:-~/.claude}/claude-mods` (Windows: `%USERPROFILE%\.claude\claude-mods`), the same in both scripts; `XDG_DATA_HOME` and `LOCALAPPDATA` are no longer used. `--dir` / `-Dir` now also refuses the Claude config folder itself.
  - Upgrading from v1.2.x: install once with the new script. The `my-mods` marketplace is registered again at the new place; plugins and `/config` values stay. Delete the old folder (`%LOCALAPPDATA%\claude-mods` or `~/.local/share/claude-mods`) by hand only **after** that install, since deleting it first breaks the marketplace.
  - v1.2.x installs have no lib file, so `--rollback` / `--uninstall` run without a file (`curl | sh`, `irm | iex`) need v1.3.0 installed once, or must be run from an unzipped v1.3.0 release folder.
  - If you sync `~/.claude` between machines (dotfiles), the bundle travels with it; the marketplace path is absolute, so it breaks on another PC. Install on each PC.

## v1.2.0 (2026-10-17)

- **agent-flow 0.4.0: the command is now `/aflow`** (`/aflow text`, `/aflow stats [days]`). Claude Code drew `/agent-flow` as one broken line in the command list (`* /agent-flow – …`); the new name draws like the other commands. The old `/agent-flow` still works through v1.2.x, hidden from the list and with a note pointing to `/aflow`; it goes in v1.3.0. Settings (`agent-flow.*`) and logged runs are unchanged.
- **agent-flow: a closed pane no longer refreshes.** The 2-second refresh runs only while the Agent flow pane is open; reopening it refreshes at once. Run logging and `/aflow stats` are not affected.
- **qhud 0.18.0: `/tcw-usage` is removed**, as announced in v1.1.0. Use `/qhud-usage`.
- Correction to v1.1.1: the shorter `/agent-flow` description did not change how its row was drawn; the command name did (fixed above).

## v1.1.1 (2026-10-17)

- **agent-flow 0.3.1: the pane opens faster.** `/agent-flow` opens the pane before it asks Claude Code for the agent list, the flow view no longer reads the stored diffs on every redraw, and a refresh that finds nothing new no longer redraws the pane.
- The `/agent-flow` description in the command list is shorter and lines up with the other commands.

## v1.1.0 (2026-10-17)

- **Renamed: tcw → qhud 0.17.0** (folder `token-cache-weather/` → `qhud/`). What it shows is unchanged.
  - Settings are not carried over: the keys move from `tcw.*` to `qhud.*`. Note your values in `/config` before updating and set them again under `qhud`.
  - `/tcw-usage` is now `/qhud-usage`; the old name still answers in v1.1.x and goes in v1.2.0.
  - Already installed? Follow `docs/migration/RENAME_TCW_TO_QHUD.md` (uninstall `tcw@my-mods`, install `qhud@my-mods`), or let the install script do it.
- **Install scripts**: the release zip now carries `install.sh` (macOS / Linux / WSL) and `install.ps1` (Windows). They install, update, roll back (`--rollback`) and remove (`--uninstall`) the four plugins; see the README "Install" section. An existing manual install is re-pointed to the new folder and keeps its `/config` values; `--uninstall` keeps plugin data but removes `/config` values.
- **change-tutor 0.4.0: off by default.** Nothing is noted and no status line shows until `change-tutor.enabled` is turned on in `/config`, or for one session with `/change-tutor on` (`/change-tutor off` stops it). Notes kept before stay readable with `/change-tutor`.

## v1.0.0 (2026-10-17)

First release from this repository.

- **tcw 0.16.2**: two lines under the prompt (model, effort, git, context fill; 5-hour, weekly and model-specific weekly limits). `/tcw-usage`.
- **change-tutor 0.3.0**: learning notes for the main agent's changes; subagents' changes moved to agent-flow.
- **pinboard 0.3.0**: `/pin` notes above the prompt, sent to Claude at once; `/pin !!` stops the running turn and sends the note now.
- **agent-flow 0.3.0**: `/agent-flow` pane for main and subagents (model, tokens, calls, current tool, slow / thinking / silent signs, `[+]` details, unlisted loops, main_Diff / sub_Diff); `/agent-flow stats` over logged runs.
- Removed from the set: blast-radius, replay-theater (`claude plugin uninstall <name>@my-mods` on machines that have them).
