# my-mods

Four Claude Code mods (plugins of function hooks). Requires **Claude Code 2.1.287 or later**.
Korean guide: [README.ko.md](README.ko.md)

---

## Commands at a glance

| Command | Example | Does |
|---|---|---|
| `/pin <note>` | `/pin upload to the drive when the render is done` | Pin a note and send it to Claude |
| `/pin ! <note>` | `/pin ! check the .env keys before deploying` | Same, marked important (red ★) |
| `/pin !! <note>` | `/pin !! stop, keep the old API` | Stop Claude's running turn and send the note now |
| `/pin done N` / `/pin undo N` | `/pin done 2` | Check off / reopen pin 2 |
| `/pin rm N` | `/pin rm 1` | Remove pin 1 |
| `/pin clear` | `/pin clear` | Remove every done pin |
| `/pin list` | `/pin list` | Print the board |
| `/pin` | `/pin` | Fold or unfold the board |
| `/change-tutor` | `/change-tutor` | Open the Change Notes pane |
| `/change-tutor on` / `off` | `/change-tutor on` | Start / stop noting changes for this session (change-tutor is off by default) |
| `/agent-flow` | `/agent-flow` | Open the Agent flow pane (main and subagents: models, tokens, calls, what each does, diffs) |
| `/agent-flow text` | `/agent-flow text` | Print the agent tree as text |
| `/agent-flow stats [days]` | `/agent-flow stats 30` | Sum the logged subagent runs by agent and model (default 7 days) |
| `/qhud-usage` | `/qhud-usage` | Read the usage endpoint now and print its answer |

---

## 1. What each mod does

### qhud — the session at a glance (formerly tcw)

Two lines under the prompt (`qhud.layout`: `bottom`, the default), no prefix:

```
Opus 5.5 · high · ⤷ Sonnet › Haiku   ⎇ main ↑2 ~3   CT 67%
0% (2d 11h)  |  98% (2h16m)  |  82% (2d 12h)
```

With `qhud.layout` = `band` the same two lines sit above the prompt. With `qhud.layout` = `line` the same goes in one status line under the prompt (Claude Code prefixes it with `⚠ qhud:`, which is why the name is short).

| Part | Meaning |
|---|---|
| `Opus 5.5` | The current model (`(1M)` on a 1M-context variant); follows `/model` switches |
| `high` | Reasoning effort of the last response (`low` / `medium` / `high` / `xhigh` / `max`; `--effort`, `/effort`); before the first response, the model's own `effortLevel` from settings (`{ "claude-opus-5-5": { "effortLevel": "high" } }`), else the top-level `effortLevel` |
| `⤷ Sonnet › Haiku` | The fallback chain from `fallbackModel` in settings.json. While a fallback is answering it reads `⤷ now Sonnet 4.5`. A chain given only with `--fallback-model` is not visible to mods, so it shows only once a fallback answers |
| `⎇ main ↑2 ~3` | Git status: branch (`@1a2b3c4` when detached), `↑` to push, `↓` to pull, `+` staged, `~` modified, `?` untracked, `!` conflicts; `✓` when clean. Left out outside a repository |
| `CT 67%` | Context window fill; `-%` before the first response. Turns yellow past 50% and red past 80% |
| `98% (2h16m)` · `82% (2d 12h)` | Usage left in the 5-hour and weekly (all models) windows and time to reset; green, yellow under 50%, red under 20%. Subscriptions only |
| `0% (2d 11h)` | A model-specific weekly window, unnamed and always first; shown only for models the account has a separate cap on, as `/usage` shows it (one per model that has its own cap). Read from the account usage endpoint at most every 5 minutes, no tokens; off with `qhud.plan` = `false`. `/qhud-usage` reads the endpoint now and shows what it answered |

Refreshes every 15 seconds and whenever a response arrives. Shows a toast once, 5 minutes before the prompt cache expires (1 minute for a 5-minute cache). **Uses no tokens**: it only reads figures the engine already has.

### change-tutor — Change Notes pane

**Off by default.** Turn it on with `change-tutor.enabled` in `/config`, or for one session with `/change-tutor on`.

Every file Claude creates or edits (Edit / Write) becomes a note with: the file and `+added -removed · time`, **🙋 Request** (your prompt for that turn), **🤔 Why it changed** (what Claude said right before the change) and the diff. From a note you can ask for **💡 Explain simply** or a four-choice **❓ Quiz**. Only the main agent's changes are noted; subagents' changes are in agent-flow (`sub_Diff`). Notes are kept across sessions (latest 100). The status line shows `📘 N change notes`.

### pinboard — notes pinned above the prompt

`/pin <note>` pins a note on a small board above the prompt that stays put however long the conversation gets. Start the note with `!` to mark it important (red, with ★), or with `!!` to interrupt Claude (below). Each row has `[✓]` to check it off (struck through, `[↺]` to reopen) and `[×]` on the right to remove it. The board is kept per folder: a new session in the same folder shows it as it was left.

Each new pin is also **sent to Claude at once**, and `/pin` runs even while Claude is working:

- Claude idle: the pin goes in as your prompt (`📌 Pin #1: …`), so Claude starts on it right away.
- Claude working: the pin is added to the conversation as a note from you and read at Claude's next step (when its current reply or tool call finishes), the same moment a message typed mid-turn is read. If the turn ends before another step reads it, it follows as a prompt (`📌 Pinned while you were working: …`).
- Claude working, `/pin !! <note>`: the running turn is stopped and the pin goes in at once as your prompt (`📌 Pin #1 (urgent — I stopped your turn for this): …`). Use it to change course now; a half-done reply or tool call is cut off, and Claude picks the work up again after reading the pin.

Off with `pinboard.deliver` = `false`.

| Command | Does |
|---|---|
| `/pin <note>`, `/pin ! <note>` | Pin a note (important with `!`) and send it to Claude |
| `/pin !! <note>` | Pin it as important, stop Claude's running turn and send it at once |
| `/pin done N`, `/pin undo N` | Check off / reopen pin N |
| `/pin rm N` | Remove pin N (same as its `[×]`) |
| `/pin clear` | Remove the done pins |
| `/pin list` | Print the board |
| `/pin` | Fold or unfold the board |

### agent-flow — main agent and subagents in one pane

`/agent-flow` opens a pane (it never opens by itself) with the main agent and every subagent of the session:

```
Agent flow · main + 2 agents · 2 running · 0 waiting
● main  Fable 5.1  running  38.2k tok  ×14  ✎3  [main_Diff] [+]  Agent Fix the parser 41s
├ ● Explore "Summarize src/greet.js"  Haiku 4.5  2s  4.1k tok  ×3  ✎0  [+]
└ ● implementer "Fix the parser"  Fable 5.1  41s  22.7k tok  ×9  ✎2  [sub_Diff] [+]  Bash npm test 3m20s  ⚠ slow 3m20s
▸ unlisted loops (1)
last: implementer · Edit src/parser.ts
```

| Part | Meaning |
|---|---|
| `●` | Yellow working (from its first request until its run ends, and again if main wakes it with a message), green done, red failed or stopped, gray idle. The headline's `running` counts main too while it is in a turn |
| `Explore "Summarize …"` | The subagent's type and task; children are indented under the agent that spawned them |
| `Fable 5.1` | The model it runs on; Fable is drawn magenta, since it spends its own weekly cap |
| `41s` | How long it has run (or ran) |
| `22.7k tok` | Tokens it spent: input, cache writes and output (cache reads left out) |
| `×9` | Tool calls it made |
| `✎2` | Files it created or edited |
| `Bash npm test 38s` | The tool call it is running now and for how long (`+1` when several run at once) |
| `⚠ slow 3m20s` | A tool call running past its threshold: 60 s, or 3 min for Bash / PowerShell. Yellow past it, red past 3×. Tools that wait by design (Agent, Monitor, AskUserQuestion, …) are never slow and are drawn dim |
| `thinking 1m10s` | A model request running 15 s or more with no tool call: long reasoning, not a stall |
| `⚠ silent 2m05s` | A working agent with no tool call and no model request under way for 2 min (red past 6 min) |
| `[+]` | Opens the model, the start of its task prompt and its last 5 tool calls with their times |
| `[main_Diff]` / `[sub_Diff]` | That agent's changes, one diff at a time |
| `▸ unlisted loops (N)` | Loops the engine's agent list does not name (a workflow's agents, engine forks like compaction), folded; click to unfold |
| `last:` | The latest thing that happened |

Session-only, no tokens spent: it reads what the engine already has. `/agent-flow text` prints the same tree as text, and where no pane can be drawn (a `-p` run, an editor extension) `/agent-flow` prints it that way by itself.

---

## 2. Install

Unzip to a folder you will keep, e.g. `C:\Users\<you>\claude-mods` or `~/claude-mods`, and run in that folder:

```bash
claude plugin marketplace add ./
claude plugin install qhud@my-mods --scope user
claude plugin install change-tutor@my-mods --scope user
claude plugin install pinboard@my-mods --scope user
claude plugin install agent-flow@my-mods --scope user
```

- `--scope user` loads them in every project, in the terminal and in the desktop app's Code tab. Install only the ones you want.
- An "option not yet set" note at install is fine: defaults apply. Add `--config ttl=1h` / `--config model=haiku` to set them up front.
- The plugins are read straight from this folder: **do not move or delete it**. After editing a file, run `/reload-plugins`.

Other ways to load them:

```bash
# one session only
claude --plugin-dir ./qhud --plugin-dir ./change-tutor --plugin-dir ./pinboard --plugin-dir ./agent-flow
```

```json
// ~/.claude/settings.json — always load (absolute paths; ";" on Windows, ":" on macOS/Linux)
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\<you>\\claude-mods\\qhud;C:\\Users\\<you>\\claude-mods\\pinboard" } }
```

Update: unzip the new version over the same folder, then run `claude plugin marketplace update my-mods` and `/reload-plugins` (or start a new session). Settings you changed in `/config` are kept.

Upgrading from a version with **tcw**? It is now **qhud**: see [docs/migration/RENAME_TCW_TO_QHUD.md](docs/migration/RENAME_TCW_TO_QHUD.md) (settings are set again under `qhud`).

Remove: `claude plugin uninstall <name>@my-mods`.

blast-radius and replay-theater are no longer part of this set. If you installed them before, remove them with `claude plugin uninstall blast-radius@my-mods` and `claude plugin uninstall replay-theater@my-mods`.

---

## 3. Usage

### qhud

Nothing to do: the lines appear when a session starts. To show the fallback chain all the time, put it in `~/.claude/settings.json`: `{ "fallbackModel": ["sonnet", "haiku"] }`.

| Setting (`/config`) | Values | Default |
|---|---|---|
| `qhud.layout` | `bottom` (2 lines under the prompt), `band` (2 lines above it), `line` (one status line under it) | `bottom` |
| `qhud.style` | `plain`, `chip` (each line on a shaded background), `box` (one rounded frame; two rows taller) — band only | `plain` |
| `qhud.model` | `true`, `false` — show the model, effort and fallback chain | `true` |
| `qhud.weather` | `true`, `false` — show `CT 67%` (context fill) | `true` |
| `qhud.plan` | `true`, `false` — show the model-specific weekly window (read every 5 minutes, no tokens) | `true` |
| `qhud.git` | `true`, `false` — show the git part (runs `git status` on each refresh, no tokens) | `true` |
| `qhud.ttl` | `1h`, `5m` — the prompt-cache TTL the expiry toast counts from | `1h` |

`/qhud-usage` reads the account usage endpoint right away and prints what it answered: use it when the model-specific window looks wrong or missing.

### change-tutor

- While noting is on, the pane opens by itself on the first change of a session; open it any time with **`/change-tutor`** (earlier notes stay readable when it is off).
- Keys work while the pane has focus (click it, or `ctrl+x tab`):

| Key | Action |
|---|---|
| `h` / `l` | Previous / next note |
| `e` | 💡 Explain simply |
| `q` | ❓ Quiz (then `1`–`4` to answer) |
| `v` | ⤢ Show all / ⤡ Collapse the diff |
| `c` | Copy diff |

- Tabs **This session** / **All notes** and **Latest** are buttons.
- Explain and Quiz call a model only when pressed (tokens are spent then).

| Setting (`/config`) | Values | Default |
|---|---|---|
| `change-tutor.enabled` | `true`, `false` — note the main agent's changes and show the count in the status line | `false` |
| `change-tutor.model` | `haiku`, `sonnet`, `opus` | `haiku` |

### pinboard

- Type **`/pin <note>`** at any time, even while Claude is working; `/pin ! <note>` marks it important, `/pin !! <note>` also stops Claude's turn so it reads the pin now. The other commands are in the table in section 1.
- Click `[✓]` / `[↺]` / `[×]` on a row, or focus the band with `ctrl+x tab` and move to the button. `[Hide]` / `[Show]` folds the board to its header line.
- A new pin reaches Claude at once: when idle it is sent as your prompt and Claude starts on it; mid-turn it is read at Claude's next step (or sent as a prompt when the turn ends, if no step read it). Checking off or removing a pin is not sent.
- Pins are saved per folder (latest 50) and come back in any new session started in that folder.

| Setting (`/config`) | Values | Default |
|---|---|---|
| `pinboard.deliver` | `true`, `false` — send each new pin to Claude | `true` |

### agent-flow

- Open it with **`/agent-flow`** whenever you want to look; it does not open by itself.
- Click `[+]` on a row for its model, task prompt and last tool calls; `▸ unlisted loops` unfolds the loops the engine does not list.
- Click `[main_Diff]` / `[sub_Diff]` (or focus the pane with `ctrl+x tab` and move to it). In the diff view: `h` / `l` previous / next change, `v` show all / collapse, `b` back to the flow.
- A new session starts with an empty flow.
- Every finished subagent run is logged (agent, model, tokens, time, calls, edits; latest 3000 runs, kept across sessions). **`/agent-flow stats [days]`** sums them, costliest first:

```
Subagent runs, last 7 days: 42 runs, 1.85M tokens (cache reads left out)
agent        model      runs    tokens  share  tok/run  time/run  calls  edits
implementer  Fable 5.1    12    980.0k    53%    81.7k     1m46s    180     41
reviewer     Sonnet 5.5   15    610.0k    33%    40.7k       28s     90      0
runner       Haiku 5.5    15    260.0k    14%    17.3k       43s    120      0
```

Use it to see which agents are worth moving to a cheaper model.

| Setting (`/config`) | Values | Default |
|---|---|---|
| `agent-flow.slowSeconds` | seconds before a tool call is ⚠ slow | `60` |
| `agent-flow.slowShellSeconds` | the same for Bash / PowerShell | `180` |
| `agent-flow.silentSeconds` | seconds before a working agent is ⚠ silent | `120` |
| `agent-flow.log` | `true`, `false` — log finished subagent runs for stats | `true` |

---

## Check

```bash
claude plugin validate ./<mod>
claude plugin test ./<mod>
```
