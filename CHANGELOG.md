# Changelog

Newest first. Each release is one `## vX.Y.Z (date)` section; the release workflow publishes that section as the release notes.

## v2.1.0 (2026-11-03)

- Added: pinboard 0.4.0 lists the prompts you type with Enter while Claude is working (mid-turn) below the pins, dimmed with a `»` marker, numbered separately, each with a `[×]` remove button. The header reads `📌 Pins N · » M`, and the board shows even with 0 pins. Idle prompts, slash commands, notifications and plugin-sent prompts are not listed; the prompt itself is sent unchanged.
- Added: each captured row also leaves a dim `» #N` marker line in the transcript; clicking the row's text scrolls the conversation to it (`[×]` still removes). If the marker is gone (e.g. after compaction outside fullscreen), a toast says the turn is no longer in view and the row is kept. Use Claude Code's `Jump to bottom (ctrl+End)` to return to the latest turn. Prompts that are only control characters are not listed.
- Session only: never saved to the folder store, gone when the session ends, latest 20 (first line, cut at 200 characters). `/pin` (fold) hides them too; `/pin done/undo/rm N` and `/pin clear` apply to pins only.
- New setting `pinboard.capture` (`true`/`false`, default `true`). It is on by default, so the dimmed rows appear after updating; turn off with `pinboard.capture` = `false` in `/config`.
- Plugins: qhud 0.18.0, pinboard 0.4.0, agent-flow 0.6.1.

## v2.0.0 (2026-10-31)

- Removed: the change-tutor plugin, with no replacement. Removing a plugin is a major change.
- Existing change-tutor users: after updating, `/plugin` lists change-tutor as `failed to load` until you remove it with `claude plugin uninstall change-tutor@my-mods --scope user`. Its saved learning notes and `/config` values are deleted with it. See `docs/migration/REMOVE_CHANGE_TUTOR.md`.
- The install scripts now list change-tutor as a retired plugin and print the uninstall command if it is installed (no automatic removal).
- agent-flow 0.6.1: header comments only, no behavior change.
- Plugins: qhud 0.18.0, pinboard 0.3.0, agent-flow 0.6.1.

## v1.0.0 (2026-10-28)

First public release. The private history before it was squashed and its releases removed; version numbers v1.1.0 to v1.4.0 that still appear in some docs refer to those private builds.

- Plugins: qhud 0.18.0, change-tutor 0.4.0, pinboard 0.3.0, agent-flow 0.6.0.
- MIT license (`LICENSE`, also shipped in the release zip).
- Plugin and marketplace author name is now `gloriouslegacy`. No setting or behavior change.
- CI and release workflows use `actions/checkout` and `actions/setup-node` v7.
