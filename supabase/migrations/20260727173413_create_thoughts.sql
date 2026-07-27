create table public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  body text not null default '',
  status text not null default 'inbox'
    constraint thoughts_status_check
    check (status in ('inbox', 'developing', 'finished', 'archived')),
  is_pinned boolean not null default false,
  review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || body
    )
  ) stored
);

comment on table public.thoughts is
  'Private, writing-first thoughts owned by an authenticated user.';

create index thoughts_user_updated_idx
  on public.thoughts (user_id, updated_at desc);

create index thoughts_user_status_updated_idx
  on public.thoughts (user_id, status, updated_at desc);

create index thoughts_review_at_idx
  on public.thoughts (user_id, review_at)
  where review_at is not null and status not in ('finished', 'archived');

create index thoughts_search_document_idx
  on public.thoughts using gin (search_document);

create function public.set_thought_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_thoughts_updated_at
before update on public.thoughts
for each row
execute function public.set_thought_updated_at();

alter table public.thoughts enable row level security;

revoke all on table public.thoughts from anon;
grant select, insert, update, delete on table public.thoughts to authenticated;
grant all on table public.thoughts to service_role;

create policy "Users can read their own thoughts"
on public.thoughts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own thoughts"
on public.thoughts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own thoughts"
on public.thoughts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own thoughts"
on public.thoughts
for delete
to authenticated
using ((select auth.uid()) = user_id);
