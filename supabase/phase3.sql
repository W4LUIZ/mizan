-- Mizan Phase 3: Strava connection storage.
-- Tokens are only readable by the server function (no client access policies).
create table if not exists public.strava_links (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  athlete_id     bigint,
  athlete_name   text,
  access_token   text,
  refresh_token  text,
  expires_at     bigint,
  oauth_state    text unique,
  state_expires  timestamptz,
  updated_at     timestamptz not null default now()
);
alter table public.strava_links enable row level security;
-- Intentionally no policies: browsers cannot read or write this table.
revoke all on public.strava_links from anon, authenticated;
