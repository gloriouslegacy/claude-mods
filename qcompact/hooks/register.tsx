// qcompact: a [Compact] button above the prompt that runs the built-in /compact on a confirmed second press.
//   [Compact]  -- press -->  [Compact?]  -- press within 5s -->  [Compacting…]  -- done or failed -->  [Compact]
// Unconfirmed for 5s, [Compact?] goes back to [Compact]; presses while compacting are ignored. The compact is
// the host's own command (queued until the session is idle); a rejection shows a toast and is logged.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Action, Phase } from '../types'
import { CONFIRM_MS, cleanReason, expire, failure, label, press } from './confirm'

const phase = atom({ plugin: 'qcompact', key: 'phase' } as const, 'idle' as Phase)

// The confirm window's expiry timer, cancelled when the second press comes first.
let expiry: ReturnType<EngineInterface['clock']['after']> | undefined

// One transcript line for a failure; never throws, so it is safe as the last handler of a rejection.
function logFailure($: EngineInterface, what: string, err: unknown): void {
  // a non-Error rejection carries no trusted text: an empty reason reads as 'unknown error'
  const reason = err instanceof Error ? err.message : ''
  try {
    // ui.log shows in the transcript, so only failures are logged; the host adds the plugin name
    $.ui.log(`${what} failed error=${cleanReason(reason)}`)
  } catch {
    // the log itself is the last place to report to: nothing is left to tell, so the line is dropped
  }
}

async function onPress($: EngineInterface): Promise<void> {
  let action = 'none' as Action // set inside the change below, so TS must not narrow it to 'none'
  // update may retry its change on a miss: the action of the change that was written wins
  await update($, phase, p => {
    const next = press(p)
    action = next.action
    return next.phase
  })
  if (action === 'arm') {
    expiry?.cancel()
    expiry = $.clock.after(CONFIRM_MS, () => void update($, phase, expire).catch(err => logFailure($, 'expire', err)))
    return
  }
  if (action !== 'run') return
  expiry?.cancel()
  expiry = undefined
  try {
    await $.command.run({ command: 'compact' })
  } catch (err) {
    $.ui.toast(failure(err instanceof Error ? err.message : ''))
    logFailure($, 'compact', err)
  } finally {
    try {
      await update($, phase, () => 'idle' as Phase)
    } catch (err) {
      // the button stays at [Compacting…] (presses ignored) until reload: the transcript line says why
      logFailure($, 'reset to idle', err)
    }
  }
}

export const register: Register = on => {
  // Our button on top, whatever else the band holds (other mods' rows) below it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const now = await read($, phase)
    const { Box, Button } = $.ui.resolve(e)
    const below = await next(e)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Button key="compact" plain dimColor={now === 'running'} label={label(now)} onPress={() => void onPress($).catch(err => logFailure($, 'press', err))} />
        </Box>
        {below}
      </Box>
    )
  })
}
