// qhud: the session at a glance, in one of two layouts (option `layout`):
//   band — two to three coloured lines above the prompt, no plugin-name prefix:
//     Opus 5.5 · high · ⤷ Sonnet › Haiku   ⎇ main ↑2 ~3   CT 67%
//     0% (2d 11h)  |  98% (2h16m)  |  82% (2d 12h)
// (the prompt-cache clock is no longer drawn; it still warns once before the cache expires)
//   bottom (default) — the same two lines under the prompt, above the engine's hint line.
//   line — the same in one status line under the prompt (the engine prefixes "⚠ qhud:").
// /qhud-usage reads the account usage endpoint now and shows what it answered (for the per-model windows).
// Refreshed every 15 s and whenever a main-thread response arrives (turn.step); a chart reading is
// taken at session start and after each main-thread turn. No model calls, so no tokens.
// Per-model weekly windows ("Fable") come from the account usage endpoint /usage reads, at most every 5 min.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CacheClock, Reading, RunInfo, TcwView } from '../types'
import { cachePart, remainingMs, warnMs } from './cache'
import type { Ttl } from './cache'
import { gitPart, parseGit } from './git'
import { chainName, modelName, settingsEffort } from './model'
import { PLAN_EVERY_MS, USAGE_HEADERS, USAGE_URL, planLimits } from './plan'
import { SEP, bandLines, build, modelBlock, oneLine, pctText } from './view'
import { BARS, leftColor, limitViews } from './weather'
import type { Limit } from './weather'

const history = atom({ plugin: 'qhud', key: 'history' } as const, [] as Reading[])
const clock = atom({ plugin: 'qhud', key: 'clock' } as const, { lastAt: null, ttl: null, warnedFor: null } as CacheClock)
const run = atom({ plugin: 'qhud', key: 'run' } as const, { effort: null, answeredBy: null } as RunInfo)
const view = atom({ plugin: 'qhud', key: 'view' } as const, null as TcwView | null)

const TICK_MS = 15_000

type Elements = ReturnType<EngineInterface['ui']['resolve']>

type Options = { ttl: Ttl; layout: 'band' | 'bottom' | 'line'; style: 'chip' | 'box' | 'plain'; model: boolean; weather: boolean; git: boolean; plan: boolean }

// The last per-model windows read; a reload reads them again.
let plan: { at: number; limits: Limit[]; note: string } = { at: -Infinity, limits: [], note: 'not read yet' }

/** Reads the endpoint now; `note` says what happened, for /qhud-usage. */
async function readPlan($: EngineInterface, now: number): Promise<string> {
  plan = { ...plan, at: now } // one try per period, even when it fails
  try {
    const auth = await $.session.authorize()
    if (!auth) {
      plan.note = 'no first-party login (API key, gateway or 3P provider): nothing to read'
      return plan.note
    }
    const r = await $.http.fetch(USAGE_URL, { headers: USAGE_HEADERS, auth: auth.handle })
    if (!r.ok) {
      plan.note = `HTTP ${r.status} (${auth.kind}): ${r.text.slice(0, 300)}`
      return plan.note
    }
    const body = JSON.parse(r.text) as unknown
    const limits = planLimits(body)
    const keys = body && typeof body === 'object' ? Object.keys(body).join(', ') : typeof body
    plan = { at: now, limits, note: `HTTP ${r.status}; keys: ${keys}; per-model windows: ${limits.map(l => l.kind).join(', ') || 'none'}` }
    const o = (body ?? {}) as Record<string, unknown>
    const detail = ['limits', 'seven_day_breakdown', 'weekly_scoped_shares'].map(k => `${k}: ${JSON.stringify(o[k] ?? null)}`).join('\n')
    return `${plan.note}\n${detail.slice(0, 3000)}`
  } catch (err) {
    plan.note = `failed: ${err instanceof Error ? err.message : String(err)}`
    return plan.note
  }
}

async function planWindows($: EngineInterface, now: number): Promise<Limit[]> {
  if (now - plan.at >= PLAN_EVERY_MS) await readPlan($, now)
  return plan.limits
}

async function gitLine($: EngineInterface): Promise<string | undefined> {
  try {
    const r = await $.process.run(['git', 'status', '--porcelain=v2', '--branch'], { cwd: await $.session.cwd(), timeoutMs: 3000 })
    if (r.exitCode !== 0) return undefined
    const s = parseGit(r.stdout)
    return s ? gitPart(s) : undefined
  } catch {
    return undefined // no git, not a repository, or too slow this time
  }
}

async function refresh($: EngineInterface, o: Options): Promise<void> {
  try {
    const [turns, state, info, usage, now, git, model, settings] = await Promise.all([
      read($, history),
      read($, clock),
      read($, run),
      $.session.usage(),
      $.clock.now(),
      o.git ? gitLine($) : Promise.resolve(undefined),
      o.model ? $.session.model().catch(() => '') : Promise.resolve(''),
      $.settings.read().catch(() => ({}) as Record<string, unknown>),
    ])
    const ttl = state.ttl ?? o.ttl
    const { context } = usage
    if (context.window <= 0) return
    const main = model ? modelName(model) : undefined
    const answered = info.answeredBy ? modelName(info.answeredBy) : undefined
    const effort = info.effort ?? settingsEffort(settings, model)
    const v = build({
      model: main,
      effort: o.model ? effort : undefined,
      fallback: o.model ? chainName(settings.fallbackModel) : undefined,
      activeFallback: main && answered && answered !== main ? answered : undefined,
      showWeather: o.weather,
      tokens: context.tokens,
      window: context.window,
      percent: context.percent,
      turns: turns.map(r => r.tokens).slice(-BARS - 1),
      git,
      cache: cachePart(state.lastAt, ttl, now),
      limits: limitViews([...(o.plan ? await planWindows($, now) : []), ...usage.rateLimits], now),
      usd: usage.cost?.usd,
    })
    if (typeof settings.theme === 'string' && settings.theme.includes('light')) v.isLight = true
    await update($, view, () => v)
    $.ui.status(o.layout === 'line' ? oneLine(v) : undefined)
    const left = state.lastAt === null ? 0 : remainingMs(state.lastAt, ttl, now)
    if (state.lastAt !== null && left > 0 && left <= warnMs(ttl) && state.warnedFor !== state.lastAt) {
      const at = state.lastAt
      await update($, clock, c => ({ ...c, warnedFor: at }))
      $.ui.toast(`🧊 Prompt cache expires in ${Math.ceil(left / 60_000)} min. Keep working to keep it warm.`)
    }
  } catch {
    // usage unavailable for a moment: keep the last view
  }
}

async function record($: EngineInterface, fallbackTokens: number | null): Promise<void> {
  const { context } = await $.session.usage()
  const tokens = context.tokens ?? fallbackTokens
  if (tokens === null || context.window <= 0) return
  const reading: Reading = { tokens, window: context.window }
  await update($, history, prev => [...(prev ?? []), reading].slice(-(BARS + 1)))
}

export const register: Register = (on, options) => {
  const o: Options = {
    ttl: options.ttl === '5m' ? '5m' : '1h',
    layout: options.layout === 'line' ? 'line' : options.layout === 'band' ? 'band' : 'bottom',
    style: options.style === 'box' ? 'box' : options.style === 'chip' ? 'chip' : 'plain',
    model: options.model !== false,
    weather: options.weather !== false,
    git: options.git !== false,
    plan: options.plan !== false,
  }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'qhud-usage', description: 'Read the account usage endpoint now and show what it answered' }).catch(() => undefined)
    // the name before qhud 0.17.0; kept through my-mods v1.1.x, removed in v1.2.0
    await $.command.register({ name: 'tcw-usage', description: 'Renamed: use /qhud-usage' }).catch(() => undefined)
    try {
      // first reading so the chart shows before the first turn; a reload keeps the history
      if ((await read($, history)).length === 0) await record($, 0)
    } catch {
      // usage unavailable at start: the chart starts after the first turn
    }
    $.clock.every(TICK_MS, () => void refresh($, o))
    await refresh($, o)
    return result
  })

  // Resumed or forked: the cache's age is the transcript's last response's.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (e.seconds_since_last_response !== undefined) {
      const at = (await $.clock.now()) - e.seconds_since_last_response * 1000
      await update($, clock, c => ({ ...c, lastAt: at }))
      await refresh($, o)
    }
    return result
  })

  // The engine says which TTL the cache runs on when the model switches.
  on('classic.PreModelSwitch', async ($, e, next) => {
    const result = await next(e)
    const ttl = e.cache_ttl
    await update($, clock, c => ({ ...c, ttl }))
    await refresh($, o)
    return result
  })

  // Every main-thread response re-arms the cache and says which model and effort answered.
  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    if (e.agentId === undefined && step.usage !== null) {
      const at = await $.clock.now()
      const effort = e.effort === undefined ? null : typeof e.effort === 'number' ? `effort ${e.effort}` : e.effort
      const answeredBy = step.usage.model || e.model
      await update($, clock, c => ({ ...c, lastAt: at }))
      await update($, run, () => ({ effort, answeredBy }))
      await refresh($, o)
    }
    return step
  })

  // One chart bar per main-thread turn.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    try {
      await record($, null)
    } catch {
      // keep the last chart rather than break the turn
    }
    await refresh($, o)
    return result
  })

  on('command.run', { command: 'qhud-usage' }, async $ => {
    const text = await readPlan($, await $.clock.now())
    await refresh($, o)
    return { text: `qhud usage endpoint: ${text}` }
  })

  on('command.run', { command: 'tcw-usage' }, async $ => {
    const text = await readPlan($, await $.clock.now())
    await refresh($, o)
    return { text: `/tcw-usage is now /qhud-usage (the old name goes in my-mods v1.2.0).\nqhud usage endpoint: ${text}` }
  })

  // Our lines as a tree. style plain (default): bare coloured text; chip: each line on a shaded
  // background; box: one rounded frame.
  const drawLines = (v: TcwView, { Box, Text }: Elements) => {
    const bg = o.style === 'chip' ? (v.isLight ? '#e8e8e8' : '#3a3a3a') : undefined
    const pad = bg ? ' ' : ''
    const bar = <Text backgroundColor={bg} dimColor>{SEP}</Text>
    const w = v.weather
    const meterTree = w ? (
      <Text backgroundColor={bg}>
        <Text backgroundColor={bg}>CT </Text>
        <Text backgroundColor={bg} color={leftColor(100 - (w.pct ?? 0))} bold>{pctText(w.pct)}</Text>
      </Text>
    ) : null
    const rows = bandLines(v).map(line =>
      line.kind === 'model' ? (
        <Text wrap="truncate" backgroundColor={bg}>
          {pad}
          <Text bold backgroundColor={bg}>{modelBlock(v) ?? ''}</Text>
          {v.git ? (
            <Text backgroundColor={bg} color={v.git.endsWith('✓') ? 'green' : 'yellow'}>
              {modelBlock(v) ? '   ' : ''}
              {v.git}
            </Text>
          ) : null}
          {meterTree ? (
            <Text backgroundColor={bg}>
              {modelBlock(v) || v.git ? '   ' : ''}
              {meterTree}
            </Text>
          ) : null}
          {pad}
        </Text>
      ) : (
        <Text wrap="truncate" backgroundColor={bg}>
          {pad}
          {v.limits.map((l, i) => (
            <Text backgroundColor={bg}>
              {i > 0 ? bar : null}
              {l.name ? <Text backgroundColor={bg}>{l.name} </Text> : null}
              <Text backgroundColor={bg} color={leftColor(l.left)} bold>{l.left}%</Text>
              {l.reset ? <Text backgroundColor={bg}> ({l.reset})</Text> : null}
            </Text>
          ))}
          {pad}
        </Text>
      ),
    )
    return o.style === 'box' ? (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} alignSelf="flex-start">
        {rows}
      </Box>
    ) : o.style === 'chip' ? (
      <Box flexDirection="column" alignItems="flex-start" rowGap={0}>
        {rows}
      </Box>
    ) : (
      <Box flexDirection="column">{rows}</Box>
    )
  }

  // band: our lines on top, whatever the band holds below them (other mods' rows).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (o.layout !== 'band' || e.props.hasSurvey) return next(e)
    const v = await read($, view)
    if (!v) return next(e)
    const { Box } = $.ui.resolve(e)
    const below = await next(e)
    return (
      <Box flexDirection="column">
        {drawLines(v, $.ui.resolve(e))}
        {below}
      </Box>
    )
  })

  // bottom: our lines under the prompt, the engine's hint line kept below them.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (o.layout !== 'bottom') return next(e)
    const v = await read($, view)
    if (!v) return next(e)
    const { Box } = $.ui.resolve(e)
    const engine = await next(e)
    return (
      <Box flexDirection="column">
        {drawLines(v, $.ui.resolve(e))}
        {engine}
      </Box>
    )
  })
}
