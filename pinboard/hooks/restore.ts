// pinboard: pure helper — what to put back on the board after a /clear reset the session atoms.

/** The board's folder (whose `pins:<folder>` it shows and saves to) and whether it is folded. */
export type Board = { folder: string; folded: boolean }

/**
 * A /clear sends no session.start and resets every atom to its initial value (folder ''), so the board
 * would show nothing and save under `pins:`. Returns the remembered board once the folder came back
 * empty, or undefined while the atoms still hold one (or nothing was remembered, so no '' key is used).
 */
export function restoreOf(folder: string, kept: Board): Board | undefined {
  return folder === '' && kept.folder !== '' ? kept : undefined
}
