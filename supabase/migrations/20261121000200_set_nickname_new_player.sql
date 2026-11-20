-- set_nickname lost the first nickname of a new device: the UPDATE's snapshot can't see the
-- player row that ensure_player inserts inside the same statement. Create the player first.
create or replace function public.set_nickname(p_device_id text, p_nickname text)
returns void
language plpgsql
as $$
declare
  v_player uuid := public.ensure_player(p_device_id);
begin
  update public.players set nickname = p_nickname where id = v_player;
end;
$$;

revoke all on function public.set_nickname(text, text) from public, anon, authenticated;
grant execute on function public.set_nickname(text, text) to service_role;
