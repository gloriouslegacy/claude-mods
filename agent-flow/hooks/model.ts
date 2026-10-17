// agent-flow: a model id as a short name — "claude-opus-5-5" → "Opus 5.5" (shared with qhud).

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
