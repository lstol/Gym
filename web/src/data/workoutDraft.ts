// A locked phone or accidental refresh should not send you back to exercise 1.
// This remembers *where you are* in a session — nothing more. Sets are saved
// straight to Supabase as they're logged; this is not a sync queue. See
// CLAUDE.md §2 — "thirty lines of code", not an outbox.

function key(templateId: string, date: string) {
  return `workout-draft:${templateId}:${date}`
}

export function getDraftExerciseIndex(templateId: string, date: string): number {
  const raw = localStorage.getItem(key(templateId, date))
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function saveDraftExerciseIndex(templateId: string, date: string, index: number): void {
  localStorage.setItem(key(templateId, date), String(index))
}

export function clearDraft(templateId: string, date: string): void {
  localStorage.removeItem(key(templateId, date))
}
