# Changelog

Newest first. Each release is one `## vX.Y.Z (date)` section; the release workflow publishes that section as the release notes.

## v2.13.0 (2026-11-18)

- Fixed: auto-resume is no longer cancelled by prompts Claude Code injects by itself. Background task completion notices (and scheduled triggers or other plugins) arrive as prompts, and qhud treated them as if you had typed something, so the resume was silently dropped. Now only a person's prompt (typed in the composer, Remote Control, or the SDK) cancels it.
- Added: when your prompt cancels a pending resume (or backup resume), qhud shows a toast with the cancelled time and tells the main Claude in the same prompt, so it can answer correctly if you ask about it.
- Added: while a resume is scheduled, the limits line ends with `↻ HH:MM` (the resume time). It appears as soon as the resume is set and goes away when it fires or is cancelled.
- Changed: the auto-resume line in the main alert now says the session resumes after the reset even if Claude stops now, matching how it has worked since v2.12.1.
- Internal: qhud option parsing moved to `hooks/options.ts`, the shared render tail to `draw.tsx`, and the `/qhud-usage` text to `plan.ts`; no behavior change.
- No existing setting keys changed or removed.
- Plugins: qhud 0.21.0, pinboard 0.8.0, agent-flow 0.12.0, qcompact 0.3.0.

## v2.12.1 (2026-11-17)

- Fixed: auto-resume now also works when the main Claude stops by itself after the nearly-used-up alert, before any window reaches 100%. A window that blocked the main Claude and had its alert sent (5h, 7d, or the main model's weekly) now also schedules the resume 60 seconds after its reset. If a window is really used up, its reset wins. With `qhud.alert` off no alert is sent, so only a real 100% schedules, as before.
- Changed: when a window that ends earlier is used up, a later schedule is moved up and set again. A time cancelled by a prompt you typed is not set again.
- Added: backup resume. If, 5 minutes after the reset, no main turn has started since the first resume and the main Claude is idle, the same resume prompt is submitted once more. A prompt you type yourself or turning `autoResume` off cancels both.
- No existing setting keys changed or removed.
- Plugins: qhud 0.20.1, pinboard 0.8.0, agent-flow 0.12.0, qcompact 0.3.0.

## v2.12.0 (2026-11-16)

- Added: qhud 0.20.0 setting `qhud.alertLeftWeekly` (percent left that triggers the alert for the 7d and model weekly windows, 1 to 50, default 2; anything outside that range is read as 2). `qhud.alertLeft` (default 5) now applies only to the 5h and spend windows. Its key name and value are unchanged, so this is not a setting rename.
- Added: qhud 0.20.0 setting `qhud.autoResume` (`true`/`false`, default `true`, on by default). When a window that blocks the main Claude (5h, 7d, or the main model's weekly) is really used up (100%), qhud submits one resume prompt 60 seconds after the latest reset time. A toast shows when it is scheduled, and the main alert note gains an auto-resume line. A prompt you type yourself cancels it; reset times already past or more than 8 days away are not scheduled. The prompt tells Claude to read `docs/mem.md` first if it exists.
- To turn auto-resume off: `/config` → `autoResume` off. Claude Code must stay running until the reset, and in a permission-bypass mode the resumed work runs tools with nobody watching.
- Internal: qhud `drawLines` moved to `hooks/draw.tsx`; no behavior change.
- No existing setting keys changed or removed.
- Plugins: qhud 0.20.0, pinboard 0.8.0, agent-flow 0.12.0, qcompact 0.3.0.

## v2.11.0 (2026-11-16)

- Added: qhud 0.19.0 warns when a usage window is nearly used up. When what is left in the 5-hour, weekly, model-specific weekly (with `qhud.plan` on) or spend window drops to `qhud.alertLeft` percent or less (default 5), it acts once per window and reset cycle: a toast for you, and a one-line note for the main Claude only (not subagents), appended to the next tool result or to the next prompt if that comes first. The note is not shown on your screen, e.g. `[qhud] Usage limit nearly reached: 7d Fable 96% used, 4% left (resets in 1h2m). Finish the current step, save progress notes, and avoid starting large new work.` Window names are `5h`, `7d`, `7d <Model>` and `spend`. The usage endpoint is still read at most every 5 minutes, so the alert can be up to 15 seconds late.
- Added: settings `qhud.alert` (`true`/`false`, default `true`) and `qhud.alertLeft` (percent left that triggers the alert, 1 to 50, default 5; anything outside that range is read as 5).
- No existing setting keys changed or removed.
- Plugins: qhud 0.19.0, pinboard 0.8.0, agent-flow 0.12.0, qcompact 0.3.0.

## v2.10.0 (2026-11-15)

- Changed: the lines above the prompt drop their plugin names, like the `[Compact]` button. pinboard 0.8.0 shows `N pins · » M` (`1 pin` for one) instead of `Pins N · » M`, and the agent-flow 0.12.0 strip shows `main + N agents · R running · W waiting`. The `/aflow` pane and `/aflow text` keep the `AFlow ·` headline.
- No setting keys changed.
- Plugins: qhud 0.18.1, pinboard 0.8.0, agent-flow 0.12.0, qcompact 0.3.0.

## v2.9.0 (2026-11-15)

- Changed: the status lines above the prompt drop their icons, keeping only text and color. pinboard 0.7.0 shows `Pins N · » M`, agent-flow 0.11.0 shows `AFlow · main + N agents · R running · W waiting`, and qcompact 0.3.0 shows `[Compact]`, `[Compact?]` and `[Compacting…]`. The 🗜 icon overlapped the button text in some terminals. Pins sent to Claude still start with 📌.
- No setting keys changed.
- Plugins: qhud 0.18.1, pinboard 0.7.0, agent-flow 0.11.0, qcompact 0.3.0.

## v2.8.0 (2026-11-13)

- Changed: qcompact 0.2.0 puts a 🗜 icon before the button label and colors it by state: `🗜 [Compact]` is cyan bold, `🗜 [Compact?]` is yellow bold, `🗜 [Compacting…]` is dim. Click behavior is unchanged.
- Changed: agent-flow 0.10.0 starts its headline with 🤖 (`🤖 AFlow · main + N agents · R running · W waiting`) and draws it magenta bold in the strip and the pane. `/aflow text` gets the icon but no color.
- Fixed: qcompact hardens its failure-message cleanup: more invisible and format characters are stripped, long messages are cut before they are processed, and error paths no longer throw (a failing toast or message read cannot leave the button stuck on `[Compacting…]`).
- No setting keys changed.
- Plugins: qhud 0.18.1, pinboard 0.6.1, agent-flow 0.10.0, qcompact 0.2.0.

## v2.7.0 (2026-11-13)

- Added: qcompact 0.1.0, a new plugin. A `[Compact]` button is always shown above the prompt; click it once to get `[Compact?]`, click again within 5 seconds to run Claude Code's built-in `/compact` (no model is called separately). It reads `[Compacting…]` while running. No settings and no commands. Idea from effortless (HeyCubit); no code was copied.
- Changed: the marketplace and both installers (`install.sh`, `install.ps1`) list qcompact, so the install script now installs four plugins by default.
- Plugins: qhud 0.18.1, pinboard 0.6.1, agent-flow 0.9.0, qcompact 0.1.0.

## v2.6.0 (2026-11-08)

- Changed: agent-flow 0.9.0 shows its name as `AFlow` instead of `Agent flow` on screen: the strip and pane headline (`AFlow · main + N agents · R running · W waiting`), the pane title, toasts, and the `/aflow` and `openOnStart` descriptions. The plugin id, setting keys and the `/aflow` command are unchanged.
- Plugins: qhud 0.18.1, pinboard 0.6.1, agent-flow 0.9.0.

## v2.5.2 (2026-11-08)

- Fixed: pinboard 0.6.1 keeps the board through `/clear`. `/clear` resets a plugin's session state without a new session start, so the board came back empty and unfolded, and a pin added afterwards was saved under an empty folder key instead of the folder's own list. The board now comes back with the folder's pins and its fold, and new pins save to the folder.
- Fixed: agent-flow 0.8.2 keeps the strip's Show/Hide choice through `/clear` (it fell back to folded).
- Changed: agent-flow tidies its pane check and adds a test for a refused pane close; no visible change.
- Plugins: qhud 0.18.1, pinboard 0.6.1, agent-flow 0.8.2.

## v2.5.1 (2026-11-08)

- Changed: agent-flow 0.8.1 closes the `/aflow` pane when you press the same strip button again (`[sub_Diff]`, `[main_Diff]` or `[+]`) while the pane shows what that button opened. Another agent's button switches the pane instead; after closing the pane by hand, the button opens it again.
- Plugins: qhud 0.18.1, pinboard 0.6.0, agent-flow 0.8.1.

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
