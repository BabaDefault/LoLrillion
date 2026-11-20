-- A confirmed "Did you mean" is logged as the Entity the player confirmed, not as a Guess of its
-- Entity ID. Additive: `guess` keeps the typed Guess that brought up the popup when the client
-- sends it, and may now be null when it doesn't.

alter table public.attempts alter column guess drop not null;
alter table public.attempts add column confirmed_entity_id text;
