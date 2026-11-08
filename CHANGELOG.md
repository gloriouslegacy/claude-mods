# Changelog

Newest first. Each release is one `## vX.Y.Z (date)` section; the release workflow publishes that section as the release notes.

## v2.5.0 (2026-11-08)

- Changed: agent-flow 0.8.0 shows the pane's buttons in the unfolded strip above the prompt: `[+]` on every row, `[sub_Diff]` / `[main_Diff]` when that agent edited files. Pressing one opens the `/aflow` pane with that row's details or diff; the strip itself stays one line per agent.
- Changed: the marketplace lists agent-flow before pinboard, so the flow strip can sit above the pin board's line. The host decides the order and this is not guaranteed; an existing install may keep the old order until the plugins are reinstalled.
- Plugins: qhud 0.18.1, pinboard 0.6.0, agent-flow 0.8.0.

## v2.4.1 (2026-11-08)

- Fixed: agent-flow 0.7.1 no longer stacks its 2-second refresh timer. Each session start (resume, compact) added another timer, so the pane and the strip above the prompt refreshed several times per tick; now the previous timer is cancelled and only one runs.
- Fixed: qhud 0.18.1 has the same fix for its 15-second status refresh timer.
- Plugins: qhud 0.18.1, pinboard 0.6.0, agent-flow 0.7.1.

## v2.4.0 (2026-11-08)

- Added: agent-flow 0.7.0 shows a one-line strip above the prompt once a subagent exists: `Agent flow · main + N agents · R running · W waiting [Show]`, folded like the pin board's line. `[Show]` / `[Hide]` unfolds one line each for main and every subagent (same content as the pane's folded rows, no `[+]` or Diff buttons). Details and diffs stay in the `/aflow` pane.
- New setting `agent-flow.band` (`true`/`false`, default `true`): show the flow above the prompt.
- New setting `agent-flow.showFlow` (`true`/`false`, default `false`): start with the flow unfolded. Applies to the first session start only; resume, compact and clear keep the state you chose.
- Changed: default of `agent-flow.autoOpen` is now `false`, so the pane no longer opens by itself. Users who already saved a value keep it; to get the old behavior turn it on in `/config`.
- Plugins: qhud 0.18.0, pinboard 0.6.0, agent-flow 0.7.0.

## v2.3.0 (2026-11-05)

- Changed: pinboard 0.6.0 starts each session with the board folded to its header line (`📌 Pins N · » M [Show]`). Click `[Show]` or type `/pin` to unfold it.
- Changed: adding a pin no longer unfolds a folded board. It stays folded until you show it.
- New setting `pinboard.showBoard` (`true`/`false`, default `false`). Set it to `true` in `/config` to start with the board shown, as before.
- Plugins: qhud 0.18.0, pinboard 0.6.0, agent-flow 0.6.1.

## v2.2.0 (2026-11-03)

- Changed: pinboard 0.5.0 lists every prompt you send with Enter, idle or while Claude is working, not only mid-turn ones. Both look the same (dimmed `»` rows, click to jump to that turn). Slash commands, notifications and plugin-sent prompts are still not listed.
- Added: rows show the first line; a row whose prompt is longer has a `[+]` button that unfolds the rest below it (up to 20 lines, 200 characters each), `[-]` folds it back. Session only, like the rows themselves.
- Changed: the `/config` title of `pinboard.capture` is now `List what you type` (key and value unchanged).
- Fixed: listing a prompt no longer prints a debug line (`pinboard: pinboard: place marker=…`) in the transcript. Only failures are logged, without the doubled `pinboard:` prefix.
- Plugins: qhud 0.18.0, pinboard 0.5.0, agent-flow 0.6.1.

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
