-- Leaderboards, percentile and the score curve count only *finished* runs: every Prompt either
-- Accepted or its answer window (plus network grace) closed. The earlier functions counted any
-- run that had merely started every Prompt. Additive: replaces day_totals and day_scores with
-- versions taking `p_closed_by`, the latest window-open time whose answer window has closed
-- (the server computes it from the Game Engine's window constants, so they live in one place).

drop function public.day_totals(date, integer);
drop function public.day_scores(date, integer, text);

-- Daily totals of counted, finished runs, for percentile and the curve.
create function public.day_totals(p_puzzle_day date, p_prompt_count integer, p_closed_by timestamptz)
returns table (total bigint)
language sql
stable
as $$
  select sum(points)::bigint as total
    from public.prompt_plays
   where puzzle_day = p_puzzle_day and not is_archive and prompt_index < p_prompt_count
   group by player_id
  having count(*) >= p_prompt_count
     and bool_and(accepted_entity_id is not null or window_open_at <= p_closed_by);
$$;

-- Each player's total for a Puzzle Day: counted (non-archive), finished runs, optionally only
-- members of one group.
create function public.day_scores(
  p_puzzle_day date,
  p_prompt_count integer,
  p_closed_by timestamptz,
  p_group_code text default null
)
returns table (device_id text, nickname text, total bigint)
language sql
stable
as $$
  select p.device_id, p.nickname, sum(pp.points)::bigint as total
    from public.prompt_plays pp
    join public.players p on p.id = pp.player_id
   where pp.puzzle_day = p_puzzle_day
     and not pp.is_archive
     and pp.prompt_index < p_prompt_count
     and (
       p_group_code is null
       or exists (
         select 1
           from public.group_members gm
           join public.groups g on g.id = gm.group_id
          where g.code = p_group_code and gm.player_id = pp.player_id
       )
     )
   group by p.device_id, p.nickname
  having count(*) >= p_prompt_count
     and bool_and(pp.accepted_entity_id is not null or pp.window_open_at <= p_closed_by);
$$;

-- Server-only: the service role calls these; nobody else may.
revoke all on function public.day_totals(date, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.day_scores(date, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.day_totals(date, integer, timestamptz) to service_role;
grant execute on function public.day_scores(date, integer, timestamptz, text) to service_role;
