// qhud: a model id as a short name — "claude-opus-5-5" → "Opus 5.5", "claude-sonnet-4-5-20250929[1m]" → "Sonnet 4.5 (1M)".

const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable']

const title = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)

export const modelName = (raw: string): string => {
  const text = raw.trim()
  const long = /\[1m\]|-1m\b/i.test(text) ? ' (1M)' : ''
  const id = text.toLowerCase().replace(/\[1m\]$/, '').replace(/^.*\//, '') // drop a provider prefix (bedrock/vertex)
  if (FAMILIES.includes(id)) return title(id) // an alias: "sonnet" → "Sonnet"
  if (!id.includes('claude')) return text // already a display name ("Opus 5.5") or another provider's model
  const words = id.replace(/^.*?claude-/, '').replace(/-\d{8}.*$/, '').replace(/[@:].*$/, '').split('-')
  const family = words.find(w => FAMILIES.includes(w))
  const numbers = words.filter(w => /^\d+$/.test(w))
  if (!family) return text
  return `${title(family)}${numbers.length > 0 ? ` ${numbers.join('.')}` : ''}${long}`
}

/** A fallback chain as "Sonnet › Haiku"; settings may hold a list or a comma-separated string. */
export const chainName = (raw: unknown): string | undefined => {
  const list = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(',') : []
  const names = list.map(m => m.trim()).filter(Boolean).map(modelName)
  return names.length > 0 ? names.join(' › ') : undefined
}

/**
 * The effort settings name for this model before the first response says it: a per-model entry
 * ({ "claude-opus-5-5": { "effortLevel": "high" } }, at any nesting up to three levels, its key
 * matched by short name so an alias matches a full id), else the top-level effortLevel.
 */
export const settingsEffort = (settings: Record<string, unknown>, model: string): string | undefined => {
  const want = model ? modelName(model) : undefined
  let found: string | undefined
  const walk = (o: Record<string, unknown>, depth: number): void => {
    for (const [key, value] of Object.entries(o)) {
      if (found || !value || typeof value !== 'object' || Array.isArray(value)) continue
      const entry = value as Record<string, unknown>
      if (want && modelName(key) === want && typeof entry.effortLevel === 'string') found = entry.effortLevel
      else if (depth < 3) walk(entry, depth + 1)
    }
  }
  walk(settings, 1)
  return found ?? (typeof settings.effortLevel === 'string' ? settings.effortLevel : undefined)
}
