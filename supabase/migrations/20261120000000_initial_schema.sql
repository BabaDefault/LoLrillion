-- LoLrillion initial schema (issue #6).
-- The app talks to these tables only from the server, with the service-role key.
-- RLS is enabled with no policies, so the anon key can read or write nothing.

-- Players: one per anonymous device ID.
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null unique,
  nickname    text,
  created_at  timestamptz not null default now()
);

-- Groups (private leaderboards) and their members.
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  created_by  uuid references public.players (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id    uuid not null references public.groups (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, player_id)
);
create index group_members_player_idx on public.group_members (player_id);

-- Prompt plays: one row per player, Puzzle Day, Prompt and live/archive run.
-- The unique key is what makes one counted play per Prompt per device per Puzzle Day:
-- re-starting a Prompt (reload, double click) can never reset its window-open time.
create table public.prompt_plays (
  id                    bigint generated always as identity primary key,
  player_id             uuid not null references public.players (id) on delete cascade,
  puzzle_day            date not null,
  prompt_index          smallint not null check (prompt_index >= 0),
  is_archive            boolean not null default false,
  window_open_at        timestamptz not null,
  accepted_entity_id    text,
  accepted_entity_name  text,
  tier                  text,
  points                integer not null default 0,
  accepted_at           timestamptz,
  created_at            timestamptz not null default now(),
  unique (player_id, puzzle_day, prompt_index, is_archive)
);
create index prompt_plays_day_idx on public.prompt_plays (puzzle_day, is_archive);

-- Attempts: every Guess and its result. Unmatched Guesses (result = 'rejected',
-- reason = 'no-match') are how missing answers and Aliases get found. "Did you mean" popups
-- and wrong-Answer-Type messages are logged too (they don't use up an Attempt).
create table public.attempts (
  id            bigint generated always as identity primary key,
  player_id     uuid not null references public.players (id) on delete cascade,
  puzzle_day    date not null,
  prompt_index  smallint not null,
  is_archive    boolean not null default false,
  guess         text not null,
  result        text not null check (result in ('accepted', 'rejected', 'did-you-mean', 'wrong-answer-type')),
  reason        text,
  entity_id     text,
  detail        jsonb,
  attempted_at  timestamptz not null
);
create index attempts_unmatched_idx on public.attempts (puzzle_day, prompt_index) where reason = 'no-match';

-- Entities offered in a "Did you mean" popup, so a confirmation can be checked against them.
create table public.offered_candidates (
  player_id     uuid not null references public.players (id) on delete cascade,
  puzzle_day    date not null,
  prompt_index  smallint not null,
  is_archive    boolean not null default false,
  entity_id     text not null,
  primary key (player_id, puzzle_day, prompt_index, is_archive, entity_id)
);

-- Answer Share: how many players' Accepted Guess was each Entity, per Prompt (counted plays only).
create table public.answer_counts (
  puzzle_day    date not null,
  prompt_index  smallint not null,
  entity_id     text not null,
  count         integer not null default 0,
  primary key (puzzle_day, prompt_index, entity_id)
);

alter table public.players enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.prompt_plays enable row level security;
alter table public.attempts enable row level security;
alter table public.answer_counts enable row level security;
alter table public.offered_candidates enable row level security;

-- Player for a device ID, created on first sight.
create function public.ensure_player(p_device_id text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.players (device_id) values (p_device_id)
  on conflict (device_id) do nothing;
  select id into v_id from public.players where device_id = p_device_id;
  return v_id;
end;
$$;

-- Start a Prompt: insert the play unless it exists, and return the stored row either way.
create function public.start_prompt_play(
  p_device_id text,
  p_puzzle_day date,
  p_prompt_index smallint,
  p_is_archive boolean,
  p_window_open_at timestamptz
)
returns setof public.prompt_plays
language plpgsql
as $$
declare
  v_player uuid := public.ensure_player(p_device_id);
begin
  insert into public.prompt_plays (player_id, puzzle_day, prompt_index, is_archive, window_open_at)
  values (v_player, p_puzzle_day, p_prompt_index, p_is_archive, p_window_open_at)
  on conflict (player_id, puzzle_day, prompt_index, is_archive) do nothing;
  return query
    select * from public.prompt_plays
    where player_id = v_player and puzzle_day = p_puzzle_day
      and prompt_index = p_prompt_index and is_archive = p_is_archive;
end;
$$;

-- Record an Accepted Guess. Only the first acceptance on a play takes effect, and only a
-- counted (non-archive) play bumps Answer Share, so counts can never be inflated.
create function public.accept_prompt_play(
  p_device_id text,
  p_puzzle_day date,
  p_prompt_index smallint,
  p_is_archive boolean,
  p_entity_id text,
  p_entity_name text,
  p_tier text,
  p_points integer
)
returns void
language plpgsql
as $$
declare
  v_player uuid := public.ensure_player(p_device_id);
  v_updated integer;
begin
  update public.prompt_plays
     set accepted_entity_id = p_entity_id,
         accepted_entity_name = p_entity_name,
         tier = p_tier,
         points = p_points,
         accepted_at = now()
   where player_id = v_player and puzzle_day = p_puzzle_day
     and prompt_index = p_prompt_index and is_archive = p_is_archive
     and accepted_entity_id is null;
  get diagnostics v_updated = row_count;

  if v_updated > 0 and not p_is_archive then
    insert into public.answer_counts as ac (puzzle_day, prompt_index, entity_id, count)
    values (p_puzzle_day, p_prompt_index, p_entity_id, 1)
    on conflict (puzzle_day, prompt_index, entity_id) do update set count = ac.count + 1;
  end if;
end;
$$;

-- Daily totals of counted runs that have started every Prompt, for percentile and the curve.
create function public.day_totals(p_puzzle_day date, p_prompt_count integer)
returns table (total bigint)
language sql
stable
as $$
  select sum(points)::bigint as total
    from public.prompt_plays
   where puzzle_day = p_puzzle_day and not is_archive
   group by player_id
  having count(*) >= p_prompt_count;
$$;

-- Today's players (the Answer Share denominator): counted runs that started any Prompt.
create function public.day_player_count(p_puzzle_day date)
returns bigint
language sql
stable
as $$
  select count(distinct player_id)
    from public.prompt_plays
   where puzzle_day = p_puzzle_day and not is_archive;
$$;

-- Server-only: the service role calls these; nobody else may.
revoke all on function public.day_player_count(date) from public, anon, authenticated;
grant execute on function public.day_player_count(date) to service_role;
revoke all on function public.ensure_player(text) from public, anon, authenticated;
revoke all on function public.start_prompt_play(text, date, smallint, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.accept_prompt_play(text, date, smallint, boolean, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.day_totals(date, integer) from public, anon, authenticated;
grant execute on function public.ensure_player(text) to service_role;
grant execute on function public.start_prompt_play(text, date, smallint, boolean, timestamptz) to service_role;
grant execute on function public.accept_prompt_play(text, date, smallint, boolean, text, text, text, integer) to service_role;
grant execute on function public.day_totals(date, integer) to service_role;
