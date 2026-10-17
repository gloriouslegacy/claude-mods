// qhud: read `git status --porcelain=v2 --branch` into one short part.

export type GitStatus = {
  branch: string
  ahead: number
  behind: number
  staged: number
  modified: number
  untracked: number
  conflicts: number
}

export const parseGit = (out: string): GitStatus | null => {
  const s: GitStatus = { branch: '', ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0, conflicts: 0 }
  let oid = ''
  let seen = false
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.oid ')) oid = line.slice(13).trim()
    else if (line.startsWith('# branch.head ')) {
      s.branch = line.slice(14).trim()
      seen = true
    } else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line)
      if (m) {
        s.ahead = Number(m[1])
        s.behind = Number(m[2])
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const xy = line.slice(2, 4)
      if (xy[0] !== '.') s.staged += 1
      if (xy[1] !== '.') s.modified += 1
    } else if (line.startsWith('u ')) s.conflicts += 1
    else if (line.startsWith('? ')) s.untracked += 1
  }
  if (!seen) return null
  if (s.branch === '(detached)') s.branch = oid && oid !== '(initial)' ? `@${oid.slice(0, 7)}` : '@detached'
  return s
}

/** "⎇ main ↑2 ↓1 +3 ~2 ?1 !1", or "⎇ main ✓" when clean and in step. */
export const gitPart = (s: GitStatus): string => {
  const bits = [`⎇ ${s.branch}`]
  if (s.ahead > 0) bits.push(`↑${s.ahead}`)
  if (s.behind > 0) bits.push(`↓${s.behind}`)
  if (s.staged > 0) bits.push(`+${s.staged}`)
  if (s.modified > 0) bits.push(`~${s.modified}`)
  if (s.untracked > 0) bits.push(`?${s.untracked}`)
  if (s.conflicts > 0) bits.push(`!${s.conflicts}`)
  if (bits.length === 1) bits.push('✓')
  return bits.join(' ')
}
