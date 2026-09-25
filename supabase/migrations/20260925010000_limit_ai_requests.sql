-- Limite diário de chamadas de IA por usuário. É consumido pelas Edge Functions
-- antes de contactar o Gemini, reduzindo risco de abuso ou custos inesperados.
create table public.ai_daily_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.ai_daily_usage enable row level security;

create or replace function public.consume_ai_request(request_limit integer default 20)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  accepted boolean;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.ai_daily_usage (user_id, usage_date, request_count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_daily_usage.request_count + 1
    where public.ai_daily_usage.request_count < request_limit
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

grant execute on function public.consume_ai_request(integer) to authenticated;
