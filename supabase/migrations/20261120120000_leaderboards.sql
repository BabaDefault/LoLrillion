-- Leaderboards, nicknames and friend groups (issue #12). Additive: builds on the tables in the
-- initial schema (players.nickname, groups, group_members) and only adds checks and functions.

alter table public.players
  add constraint players_nickname_length check (nickname is null or char_length(nickname) between 1 and 20);
alter table public.groups
  add constraint groups_name_length check (char_length(name) between 1 and 30);

-- Set or change a device's nickname.
create function public.set_nickname(p_device_id text, p_nickname text)
returns void
language plpgsql
as $$
begin
  update public.players set nickname = p_nickname where id = public.ensure_player(p_device_id);
end;
$$;

-- Create a group with the device as its first member. False (nothing created) if the code is taken.
create function public.create_group(p_device_id text, p_code text, p_name text)
returns boolean
language plpgsql
as $$
declare
  v_player uuid := public.ensure_player(p_device_id);
  v_group uuid;
begin
  insert into public.groups (code, name, created_by) values (p_code, p_name, v_player)
  on conflict (code) do nothing
  returning id into v_group;
  if v_group is null then
    return false;
  end if;
  insert into public.group_members (group_id, player_id) values (v_group, v_player);
  return true;
end;
$$;

-- Join the group with this code (joining twice is harmless). No rows if there's no such group.
create function public.join_group(p_device_id text, p_code text)
returns table (code text, name text)
language plpgsql
as $$
declare
  v_player uuid := public.ensure_player(p_device_id);
  v_group uuid;
begin
  select g.id into v_group from public.groups g where g.code = p_code;
  if v_group is null then
    return;
  end if;
  insert into public.group_members (group_id, player_id) values (v_group, v_player)
  on conflict do nothing;
  return query select g.code, g.name from public.groups g where g.id = v_group;
end;
$$;

-- The device's groups, oldest membership first.
create function public.player_groups(p_device_id text)
returns table (code text, name text)
language sql
stable
as $$
  select g.code, g.name
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    join public.players p on p.id = gm.player_id
   where p.device_id = p_device_id
   order by gm.joined_at, g.created_at;
$$;

-- Each player's total for a Puzzle Day: counted (non-archive) runs that have started every
-- Prompt, optionally only members of one group. Past days never change, because plays for a
-- past day can only be archive plays.
create function public.day_scores(p_puzzle_day date, p_prompt_count integer, p_group_code text default null)
returns table (device_id text, nickname text, total bigint)
language sql
stable
as $$
  select p.device_id, p.nickname, sum(pp.points)::bigint as total
    from public.prompt_plays pp
    join public.players p on p.id = pp.player_id
   where pp.puzzle_day = p_puzzle_day
     and not pp.is_archive
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
  having count(*) >= p_prompt_count;
$$;

-- Server-only: the service role calls these; nobody else may.
revoke all on function public.set_nickname(text, text) from public, anon, authenticated;
revoke all on function public.create_group(text, text, text) from public, anon, authenticated;
revoke all on function public.join_group(text, text) from public, anon, authenticated;
revoke all on function public.player_groups(text) from public, anon, authenticated;
revoke all on function public.day_scores(date, integer, text) from public, anon, authenticated;
grant execute on function public.set_nickname(text, text) to service_role;
grant execute on function public.create_group(text, text, text) to service_role;
grant execute on function public.join_group(text, text) to service_role;
grant execute on function public.player_groups(text) to service_role;
grant execute on function public.day_scores(date, integer, text) to service_role;
