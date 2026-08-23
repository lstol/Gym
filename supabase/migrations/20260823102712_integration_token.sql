-- Strava refresh tokens. RLS is enabled with ZERO policies: no client, anon or
-- authenticated, can read or write this table under any circumstance. Only the
-- service role (used exclusively inside Edge Functions) bypasses RLS. See
-- CLAUDE.md §4.8 / ARCHITECTURE.md §4 — this table gets no client policy at all.
create table integration_token (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table integration_token enable row level security;
