/** Per-session-code colours so A/B/C are distinguishable at a glance. */
export const SESSION_ACCENT: Record<string, { bg: string; soft: string; text: string }> = {
  A: { bg: 'bg-sess-a', soft: 'bg-brand-soft', text: 'text-sess-a' },
  B: { bg: 'bg-sess-b', soft: 'bg-sess-b/10', text: 'text-sess-b' },
  C: { bg: 'bg-sess-c', soft: 'bg-sess-c/10', text: 'text-sess-c' },
  default: { bg: 'bg-muted', soft: 'bg-sunken', text: 'text-muted' },
}
