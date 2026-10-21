-- Mizan: opt-in sharing of daily food logs within a household.
-- Each person turns it on in Settings. Only daily logs (meals and workouts) are shared;
-- profile, weight and targets stay private.
alter table public.members add column if not exists share_log boolean not null default false;

drop policy if exists "user_docs: household shared logs" on public.user_docs;
create policy "user_docs: household shared logs" on public.user_docs for select to authenticated
  using (
    doc_id like 'm-%'
    and exists (
      select 1 from public.members m
      where m.user_id = user_docs.user_id
        and m.household_id = public.my_household()
        and m.share_log
    )
  );
