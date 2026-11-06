-- Run in the Supabase SQL Editor to enable private, editable TTM mailing logs.
begin;

create table if not exists public.collector_ttm_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    signer_name text not null check (char_length(btrim(signer_name)) between 1 and 200),
    date_sent date not null,
    status text not null default 'pending' check (status in ('pending', 'success', 'no-response', 'returned')),
    date_received date,
    notes text check (notes is null or char_length(notes) <= 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists collector_ttm_logs_user_date_idx
    on public.collector_ttm_logs (user_id, date_sent desc);

alter table public.collector_ttm_logs enable row level security;
revoke all on public.collector_ttm_logs from public, anon, authenticated;
grant select, insert, update, delete on public.collector_ttm_logs to authenticated;

drop policy if exists collector_ttm_logs_select_own on public.collector_ttm_logs;
drop policy if exists collector_ttm_logs_insert_own on public.collector_ttm_logs;
drop policy if exists collector_ttm_logs_update_own on public.collector_ttm_logs;
drop policy if exists collector_ttm_logs_delete_own on public.collector_ttm_logs;
create policy collector_ttm_logs_select_own on public.collector_ttm_logs
    for select to authenticated using (user_id = (select auth.uid()));
create policy collector_ttm_logs_insert_own on public.collector_ttm_logs
    for insert to authenticated with check (user_id = (select auth.uid()));
create policy collector_ttm_logs_update_own on public.collector_ttm_logs
    for update to authenticated using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy collector_ttm_logs_delete_own on public.collector_ttm_logs
    for delete to authenticated using (user_id = (select auth.uid()));

commit;
