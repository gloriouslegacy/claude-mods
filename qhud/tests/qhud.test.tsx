import { expect, mock, test } from 'claude-code/testing'

import { cachePart } from '../hooks/cache'
import { gitPart, parseGit } from '../hooks/git'
import { chainName, modelName, settingsEffort } from '../hooks/model'
import { planLimits } from '../hooks/plan'
import { bandLines, build, oneLine } from '../hooks/view'
import { delta, fmt, forecast, limitText, limitViews, meter, span, sparkline } from '../hooks/weather'

const MIN = 60_000

test('pieces', () => {
  expect([24, 25, 50, 75, 90].map(p => forecast(p).word)).toEqual(['Clear', 'Cloudy', 'Showers', 'Storm', 'Compact soon'])
  expect(fmt(134_400)).toBe('134.4k')
  expect(sparkline([0, 36_100, 134_400])).toBe('▁▃█')
  expect(delta([36_100, 134_400])).toBe('▲ +98.3k')
  expect(cachePart(null, '1h', 0)).toBe('🧊 cache idle')
  expect(cachePart(0, '1h', 2 * MIN)).toBe('🧊 cache 58m')
  expect(cachePart(0, '5m', 5 * MIN)).toBe('🔥 cache expired')
  expect(span((2 * 24 + 12) * 60 * MIN)).toBe('2d 12h')
  expect(span(136 * MIN)).toBe('2h16m')
  const lims = limitViews([{ kind: 'five_hour', percentUsed: 2, resetsAt: new Date(136 * MIN).toISOString() }, { kind: 'spend_limit', percentUsed: 90 }], 0)
  expect(lims.map(limitText)).toEqual(['98% (2h16m)', 'spend 10%'])
  expect(meter(0)).toBe('[----------]')
  expect(meter(7)).toBe('[███████---]')
})

test('model names and fallback chains', () => {
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-sonnet-4-5-20250929')).toBe('Sonnet 4.5')
  expect(modelName('claude-opus-4-6[1m]')).toBe('Opus 4.6 (1M)')
  expect(modelName('sonnet')).toBe('Sonnet')
  expect(chainName(['sonnet', 'claude-haiku-4-5'])).toBe('Sonnet › Haiku 4.5')
  expect(chainName('sonnet,haiku')).toBe('Sonnet › Haiku')
  expect(chainName(undefined)).toBe(undefined)
})

test('git status part', () => {
  const s = parseGit('# branch.oid 1a2b3c4\n# branch.head main\n# branch.ab +2 -1\n1 .M N... a b c d e f x\n? y\n')
  expect(s && gitPart(s)).toBe('⎇ main ↑2 ↓1 ~1 ?1')
})

const sample = build({
  model: 'Opus 5.5',
  effort: 'high',
  fallback: 'Sonnet › Haiku',
  showWeather: true,
  tokens: 134_400,
  window: 200_000,
  turns: [0, 36_100, 134_400],
  git: '⎇ main ↑2 ~3',
  cache: '🧊 cache 58m',
  limits: [{ name: '', left: 98, reset: '2h16m' }, { name: '', left: 82, reset: '2d 12h' }],
  usd: 15.5,
})

test('one line and band layouts', () => {
  expect(oneLine(sample)).toBe(
    'Opus 5.5 · high · ⤷ Sonnet › Haiku  |  ⎇ main ↑2 ~3  |  CT 67%  |  98% (2h16m)  |  82% (2d 12h)',
  )
  expect(bandLines(sample).map(l => l.text)).toEqual([
    'Opus 5.5 · high · ⤷ Sonnet › Haiku   ⎇ main ↑2 ~3   CT 67%',
    '98% (2h16m)  |  82% (2d 12h)',
  ])
  const before = build({ showWeather: true, window: 1_000_000, turns: [], cache: '🧊 cache idle', limits: [] })
  expect(bandLines(before).map(l => l.text)).toEqual(['CT -%'])
  const quiet = build({ showWeather: false, tokens: 1, window: 2, turns: [], cache: '🧊 cache idle', limits: [] })
  expect(bandLines(quiet).map(l => l.text)).toEqual([])
  const fallingBack = build({ model: 'Opus 5.5', fallback: 'Sonnet', activeFallback: 'Sonnet 4.5', showWeather: false, tokens: 1, window: 2, turns: [], cache: 'c', limits: [] })
  expect(oneLine(fallingBack)).toBe('Opus 5.5 · ⤷ now Sonnet 4.5')
})

const usageValue = (tokens: number | undefined) => ({
  value: {
    startedAt: 0,
    rateLimits: [{ kind: 'five_hour', percentUsed: 2, resetsAt: new Date(1_000_000 + 136 * MIN).toISOString() }],
    context: { tokens, window: 200_000 },
    cost: { usd: 15.5 },
  },
})

const stepUsage = (model: string) => ({ input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model })

test('line layout: one status line, countdown, effort and a fallback in use', { options: { layout: 'line', git: false, plan: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const shown: (string | undefined)[] = []
  const toasts: string[] = []
  let tokens: number | undefined
  let answeredBy = 'claude-opus-5-5'
  on('session.usage', () => usageValue(tokens))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('settings.read', () => ({ value: { effortLevel: 'medium', fallbackModel: ['sonnet', 'haiku'] } }))
  on('ui.status', (_$, e) => {
    shown.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/' }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: stepUsage(answeredBy) }
  })
  const turn = { answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' as const }
  const step = async () => {
    for await (const _ of $.turn.step({ turnId: 't', index: 0, model: answeredBy, effort: 'high', messageCount: 1 })) {
      // drain
    }
  }

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(shown.at(-1)).toBe('Opus 5.5 · medium · ⤷ Sonnet › Haiku  |  CT -%  |  98% (2h16m)')

  tokens = 36_100
  await step()
  await $.turn.complete(turn)
  tokens = 134_400
  await step()
  await $.turn.complete(turn)
  expect(shown.at(-1)).toBe('Opus 5.5 · high · ⤷ Sonnet › Haiku  |  CT 67%  |  98% (2h16m)')

  answeredBy = 'claude-sonnet-4-5'
  await step()
  expect(shown.at(-1)).toContain('Opus 5.5 · high · ⤷ now Sonnet 4.5  |  ')

  await clock.advance(56 * MIN)
  expect(toasts.length).toBe(1)
  await clock.advance(5 * MIN)
  expect(toasts.length).toBe(1)
})

const STYLES = [
  ['terminal', 'plain'],
  ['desktop', 'plain'],
  ['terminal', 'chip'],
  ['desktop', 'chip'],
  ['terminal', 'box'],
] as const

for (const [surface, style] of STYLES) {
  test(`band layout (${style}): two lines above the prompt, other rows kept below, on ${surface}`, { options: { layout: 'band', git: true, style, plan: false } }, async ($, on) => {
    mock.clock(on, { now: 0 })
    const shown: (string | undefined)[] = []
    on('session.usage', () => usageValue(102_000))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.cwd', () => ({ value: '/p' }))
    on('settings.read', () => ({ value: { effortLevel: 'xhigh', theme: 'light' } }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: '# branch.oid abc\n# branch.head main\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    on('ui.status', (_$, e) => {
      shown.push(e.text)
      return { value: undefined }
    })
    on('session.start', () => ({ cwd: '/p' }))
    on('ui.render', ($$, e) => {
      const { Box, Text } = $$.ui.resolve(e)
      return (
        <Box key="engine">
          <Text>other row</Text>
        </Box>
      )
    })
    await $.session.start({ cwd: '/p', surface, isInteractive: true })
    expect(shown.at(-1)).toBe(undefined)

    const band = await $.ui.mount({ plugin: 'qhud', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} } })
    expect(await band.find({ text: /^ ?Opus 5\.5 · xhigh {3}⎇ main ✓ {3}CT 51% ?$/ })).toBeDefined()
    expect(await band.find({ text: /⎇ main ✓/ })).toBeDefined()
    expect(await band.find({ text: /^ ?98% \(2h33m\) ?$/ })).toBeDefined()
    expect(await band.find({ text: /cache/ })).toBeUndefined()
    expect(await band.find({ text: 'other row' })).toBeDefined()
    const tree = JSON.stringify(await band.drawn())
    expect(tree.includes('"backgroundColor":"#e8e8e8"')).toBe(style === 'chip')
    expect(tree.includes('"borderStyle":"round"')).toBe(style === 'box')
  })
}

test('per-model weekly windows from the usage endpoint', () => {
  const body = {
    five_hour: { utilization: 1, resets_at: null },
    seven_day: { utilization: 62, resets_at: '2026-10-12T19:00:00Z' },
    seven_day_fable: { utilization: 100, resets_at: new Date(2 * 24 * 60 * MIN + 11 * 60 * MIN).toISOString() },
    seven_day_opus: null,
    seven_day_oauth_apps: { utilization: 5 },
  }
  const lims = planLimits(body)
  expect(lims.map(l => l.kind)).toEqual(['seven_day_fable'])
  expect(limitViews(lims, 0).map(limitText)).toEqual(['0% (2d 11h)'])
  expect(planLimits('nope')).toEqual([])
})

test('line layout shows the Fable weekly window after 5h and 7d', { options: { layout: 'line', git: false, model: false, weather: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  const shown: (string | undefined)[] = []
  let fetched = 0
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      rateLimits: [
        { kind: 'five_hour', percentUsed: 1, resetsAt: new Date(261 * MIN).toISOString() },
        { kind: 'seven_day', percentUsed: 62, resetsAt: new Date((2 * 24 * 60 + 11 * 60) * MIN).toISOString() },
      ],
      context: { tokens: 1, window: 200_000 },
    },
  }))
  on('settings.read', () => ({ value: {} }))
  on('session.authorize', () => ({ value: { handle: 'h', kind: 'bearer' as const } }))
  on('http.fetch', (_$, e) => {
    fetched++
    expect(e.url).toBe('https://api.anthropic.com/api/oauth/usage')
    const text = JSON.stringify({ seven_day_fable: { utilization: 100, resets_at: new Date((2 * 24 * 60 + 11 * 60) * MIN).toISOString() } })
    return { value: { status: 200, ok: true, headers: {}, text } }
  })
  on('ui.status', (_$, e) => {
    shown.push(e.text)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(shown.at(-1)).toBe('0% (2d 11h)  |  99% (4h21m)  |  38% (2d 11h)')
  expect(fetched).toBe(1)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`bottom layout: the lines under the prompt, the hint line kept, on ${surface}`, { options: { layout: 'bottom', git: false, plan: false } }, async ($, on) => {
    mock.clock(on, { now: 0 })
    on('session.usage', () => usageValue(102_000))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('settings.read', () => ({ value: {} }))
    on('ui.status', () => ({ value: undefined }))
    on('session.start', () => ({ cwd: '/' }))
    on('ui.render', ($$, e) => {
      const { Text } = $$.ui.resolve(e)
      return <Text>? for shortcuts</Text>
    })
    await $.session.start({ cwd: '/', surface, isInteractive: true })
    const above = await $.ui.mount({ plugin: 'qhud', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} } })
    expect(await above.find({ text: /CT / })).toBeUndefined()
    const hint = await $.ui.mount({ plugin: 'qhud', surface, component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } })
    expect(await hint.find({ text: /^ ?Opus 5\.5 {3}CT 51% ?$/ })).toBeDefined()
    expect(await hint.find({ text: '? for shortcuts' })).toBeDefined()
  })
}

test('/qhud-usage shows what the endpoint answered', { options: { layout: 'line', git: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.usage', () => usageValue(1))
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('settings.read', () => ({ value: {} }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', () => ({ value: undefined }))
  on('session.authorize', () => ({ value: { handle: 'h', kind: 'bearer' as const } }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '{"five_hour":{"utilization":2},"seven_day_fable":{"utilization":100}}' } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'qhud-usage', args: '' })
  expect(r.text).toContain('keys: five_hour, seven_day_fable; per-model windows: seven_day_fable')
})

test('model-scoped weekly windows from the limits list', () => {
  const resets = new Date((2 * 24 * 60 + 10 * 60) * MIN).toISOString()
  const body = {
    seven_day_opus: null,
    limits: [
      { kind: 'session', group: 'session', percent: 3, resets_at: resets, scope: null },
      { kind: 'weekly_all', group: 'weekly', percent: 62, resets_at: resets, scope: null },
      { kind: 'weekly_scoped', group: 'weekly', percent: 100, resets_at: resets, scope: 'claude-fable' },
      { kind: 'weekly_scoped', group: 'weekly', percent: 40, resets_at: resets, scope: { model_family: 'Opus', display: 'Opus' } },
    ],
  }
  expect(limitViews(planLimits(body), 0).map(limitText)).toEqual(['0% (2d 10h)', '60% (2d 10h)'])
})

test('band: the Fable window leads the limits line', () => {
  const v = build({ showWeather: true, tokens: 1, window: 100, turns: [], cache: 'c', limits: [{ name: '', left: 0, reset: '2d 10h' }, { name: '', left: 98 }] })
  expect(bandLines(v).map(l => l.text)).toEqual(['CT 1%', '0% (2d 10h)  |  98%'])
})

test('effort from settings before the first response', () => {
  const settings = { effortLevel: 'low', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } }
  expect(settingsEffort(settings, 'claude-opus-5-5')).toBe('high')
  expect(settingsEffort(settings, 'opus')).toBe('low')
  expect(settingsEffort(settings, 'claude-fable-5-1')).toBe('low')
  expect(settingsEffort({}, 'claude-fable-5-1')).toBe(undefined)
})

test('/tcw-usage still answers, pointing to /qhud-usage', { options: { layout: 'line', git: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.usage', () => usageValue(1))
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('settings.read', () => ({ value: {} }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', () => ({ value: undefined }))
  on('session.authorize', () => ({ value: { handle: 'h', kind: 'bearer' as const } }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '{}' } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'tcw-usage', args: '' })
  expect(r.text).toContain('/tcw-usage is now /qhud-usage')
})
