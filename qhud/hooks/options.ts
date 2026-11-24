// qhud: the userConfig values → the typed options register.tsx runs on (defaults for anything unset or unknown).
import { alertLeft, alertLeftWeekly } from './alert'
import type { Ttl } from './cache'

export type Options = { ttl: Ttl; layout: 'band' | 'bottom' | 'line' | 'compact'; style: 'chip' | 'box' | 'plain'; model: boolean; weather: boolean; git: boolean; plan: boolean; alert: boolean; alertLeft: number; alertLeftWeekly: number; autoResume: boolean }

export const parseOptions = (options: Readonly<Record<string, unknown>>): Options => ({
  ttl: options.ttl === '5m' ? '5m' : '1h',
  layout: options.layout === 'line' || options.layout === 'band' || options.layout === 'compact' ? options.layout : 'bottom',
  style: options.style === 'box' ? 'box' : options.style === 'chip' ? 'chip' : 'plain',
  model: options.model !== false,
  weather: options.weather !== false,
  git: options.git !== false,
  plan: options.plan !== false,
  alert: options.alert !== false,
  alertLeft: alertLeft(options.alertLeft),
  alertLeftWeekly: alertLeftWeekly(options.alertLeftWeekly),
  autoResume: options.autoResume !== false,
})
