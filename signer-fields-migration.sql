-- Run this once in the Supabase SQL Editor for projects that already ran supabase-setup.sql.
-- The public address field is optional; source URLs are required by the submission form.
alter table public.signer_submissions
    add column if not exists source_url text check (source_url is null or char_length(source_url) between 1 and 2000),
    add column if not exists source_date date;

alter table public.signers
    add column if not exists source_url text check (source_url is null or char_length(source_url) between 1 and 2000),
    add column if not exists source_date date,
    add column if not exists last_verified_at timestamptz default now();

create or replace function public.review_signer_submission(p_submission_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare submission public.signer_submissions%rowtype;
begin
    if not public.is_site_admin() then
        raise exception 'Only a site administrator can review signer submissions';
    end if;
    update public.signer_submissions
       set status = case when p_approve then 'approved' else 'rejected' end,
           reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_submission_id and status = 'pending'
     returning * into submission;
    if not found then raise exception 'This signer submission is no longer pending'; end if;
    if p_approve then
        insert into public.signers (name, sport, team, success_rate, avg_response, tested_address, source_url, source_date, last_verified_at)
        values (submission.name, submission.sport, submission.team, submission.success_rate,
                submission.avg_response, submission.tested_address, submission.source_url, submission.source_date, now());
    end if;
end;
$$;
revoke all on function public.review_signer_submission(uuid, boolean) from public;
grant execute on function public.review_signer_submission(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
