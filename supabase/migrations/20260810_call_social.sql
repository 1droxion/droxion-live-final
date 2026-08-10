begin;

create table if not exists public.droxion_call_messages (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.droxion_calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.droxion_call_gifts (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.droxion_calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  gift_code text not null,
  gift_name text not null,
  cost_coins integer not null check (cost_coins > 0),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists droxion_call_messages_call_idx on public.droxion_call_messages(call_id, id);
create index if not exists droxion_call_gifts_call_idx on public.droxion_call_gifts(call_id, recipient_id, id);

alter table public.droxion_call_messages enable row level security;
alter table public.droxion_call_gifts enable row level security;

revoke all on public.droxion_call_messages from public, anon;
revoke all on public.droxion_call_gifts from public, anon;
grant select, insert on public.droxion_call_messages to authenticated;
grant select on public.droxion_call_gifts to authenticated;
grant usage, select on sequence public.droxion_call_messages_id_seq to authenticated;
grant usage, select on sequence public.droxion_call_gifts_id_seq to authenticated;

drop policy if exists "call message participants read" on public.droxion_call_messages;
create policy "call message participants read"
  on public.droxion_call_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.droxion_calls c
      where c.id = call_id and auth.uid() in (c.user_a, c.user_b)
    )
  );

drop policy if exists "call message sender insert" on public.droxion_call_messages;
create policy "call message sender insert"
  on public.droxion_call_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.droxion_calls c
      where c.id = call_id
        and c.status = 'connected'
        and auth.uid() in (c.user_a, c.user_b)
        and recipient_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    )
  );

drop policy if exists "call gifts participants read" on public.droxion_call_gifts;
create policy "call gifts participants read"
  on public.droxion_call_gifts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.droxion_calls c
      where c.id = call_id and auth.uid() in (c.user_a, c.user_b)
    )
  );

create or replace function public.droxion_send_call_gift(p_call_id uuid, p_gift_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.droxion_calls%rowtype;
  v_wallet public.droxion_wallets%rowtype;
  v_recipient uuid;
  v_code text := lower(trim(coalesce(p_gift_code, '')));
  v_name text;
  v_cost int;
begin
  select * into v_call from public.droxion_calls where id = p_call_id for update;
  if v_call.id is null or v_call.status <> 'connected' or auth.uid() not in (v_call.user_a, v_call.user_b) then
    return jsonb_build_object('allowed', false, 'reason', 'call_not_connected');
  end if;

  case v_code
    when 'rose' then v_name := 'Rose'; v_cost := 5;
    when 'heart' then v_name := 'Heart'; v_cost := 10;
    when 'star' then v_name := 'Star'; v_cost := 25;
    when 'crown' then v_name := 'Crown'; v_cost := 100;
    else return jsonb_build_object('allowed', false, 'reason', 'invalid_gift');
  end case;

  v_recipient := case when v_call.user_a = auth.uid() then v_call.user_b else v_call.user_a end;

  select * into v_wallet from public.droxion_wallets where user_id = auth.uid() for update;
  if v_wallet.user_id is null then
    insert into public.droxion_wallets(user_id) values (auth.uid()) on conflict (user_id) do nothing;
    select * into v_wallet from public.droxion_wallets where user_id = auth.uid() for update;
  end if;

  if v_wallet.coin_balance < v_cost then
    return jsonb_build_object('allowed', false, 'reason', 'insufficient_coins', 'required_coins', v_cost, 'coin_balance', v_wallet.coin_balance);
  end if;

  update public.droxion_wallets
  set coin_balance = coin_balance - v_cost,
      updated_at = now()
  where user_id = auth.uid()
  returning * into v_wallet;

  insert into public.droxion_call_gifts(call_id, sender_id, recipient_id, gift_code, gift_name, cost_coins)
  values (p_call_id, auth.uid(), v_recipient, v_code, v_name, v_cost);

  return jsonb_build_object('allowed', true, 'coin_balance', v_wallet.coin_balance, 'gift_code', v_code, 'gift_name', v_name, 'cost_coins', v_cost);
end;
$$;

revoke all on function public.droxion_send_call_gift(uuid, text) from public, anon;
grant execute on function public.droxion_send_call_gift(uuid, text) to authenticated;

commit;
