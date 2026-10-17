-- Tokens are encrypted by the server before insertion. No browser role can read them.
create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_account_sub text,
  account_email text,
  refresh_token text,
  access_token text,
  access_expires_at timestamptz,
  task_list_id text,
  calendar_id text,
  time_zone text not null default 'America/Sao_Paulo',
  connected boolean not null default false,
  sync_at timestamptz,
  sync_locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_account_sub text not null,
  -- Keep a link after deletion long enough to remove its external reminders.
  transaction_id uuid not null,
  task_id text,
  event_id text not null,
  app_fingerprint text,
  app_status text,
  google_status text,
  google_updated_at timestamptz,
  last_synced_at timestamptz not null default '1970-01-01T00:00:00Z',
  primary key (user_id, google_account_sub, transaction_id)
);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_links enable row level security;
revoke all on public.google_calendar_connections from anon, authenticated;
revoke all on public.google_calendar_links from anon, authenticated;
grant all on public.google_calendar_connections to service_role;
grant all on public.google_calendar_links to service_role;
