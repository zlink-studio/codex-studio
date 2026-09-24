alter table public.approvals
  alter column task_id drop not null,
  add column if not exists subject_type text not null default 'task',
  add column if not exists subject_id text;

update public.approvals
set subject_type = 'task', subject_id = task_id::text
where subject_id is null and task_id is not null;

alter table public.daily_reports
  add column if not exists content_metrics jsonb not null default '{}'::jsonb;

create table if not exists public.content_items (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  platform text not null default 'xiaohongshu' check (platform in ('xiaohongshu')),
  account_scope text not null default 'owned' check (account_scope in ('owned', 'client')),
  account_ref text,
  format text not null default 'image_text' check (format in ('image_text', 'video')),
  title text not null,
  caption text not null,
  script text,
  hashtags text[] not null default '{}',
  asset_prompt text,
  asset_provider text,
  asset_urls text[] not null default '{}',
  cover_url text,
  asset_status text not null default 'missing' check (asset_status in ('missing', 'generating', 'ready', 'failed')),
  quality_status text not null default 'pending' check (quality_status in ('pending', 'approved', 'rejected')),
  quality_score integer check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  quality_checklist jsonb not null default '[]'::jsonb,
  quality_notes text,
  approval_level text not null default 'L1' check (approval_level in ('L0', 'L1', 'L2', 'L3')),
  approval_status text not null default 'not_required' check (approval_status in ('not_required', 'pending', 'approved', 'rejected', 'manual_only')),
  status text not null default 'draft' check (status in (
    'draft', 'asset_generating', 'asset_failed', 'review', 'rejected', 'pending_approval',
    'approved', 'scheduled', 'publish_queued', 'publishing', 'published', 'publish_failed', 'cancelled'
  )),
  scheduled_at timestamptz,
  queued_at timestamptz,
  published_at timestamptz,
  publication_id text,
  publication_url text,
  n8n_execution_id text,
  idempotency_key text not null unique,
  publish_attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  performance_metrics jsonb not null default '{}'::jsonb,
  manual_minutes integer not null default 0 check (manual_minutes >= 0),
  created_by_agent_id uuid references public.agents(id) on delete set null,
  reviewed_by_agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_item_events (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'system',
  actor_id text,
  external_event_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists content_item_events_external_event_idx
  on public.content_item_events(external_event_id)
  where external_event_id is not null;
create index if not exists content_items_owner_status_schedule_idx
  on public.content_items(owner_id, status, scheduled_at);
create index if not exists content_items_project_created_idx
  on public.content_items(project_id, created_at desc);
create index if not exists content_items_publish_metrics_idx
  on public.content_items(owner_id, published_at desc)
  where status = 'published';
create index if not exists content_item_events_item_created_idx
  on public.content_item_events(content_item_id, created_at desc);
create index if not exists approvals_subject_status_idx
  on public.approvals(owner_id, subject_type, subject_id, status);

alter table public.content_items enable row level security;
alter table public.content_item_events enable row level security;

drop policy if exists "Owners manage content items" on public.content_items;
create policy "Owners manage content items" on public.content_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners read content item events" on public.content_item_events;
create policy "Owners read content item events" on public.content_item_events
  for select using (auth.uid() = owner_id);

grant all privileges on public.content_items, public.content_item_events to service_role;
grant select, insert, update, delete on public.content_items to authenticated;
grant select on public.content_item_events to authenticated;

create or replace function public.queue_due_content_items(batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_count integer := 0;
begin
  with candidates as (
    select id
    from public.content_items
    where status in ('approved', 'scheduled', 'publish_failed')
      and quality_status = 'approved'
      and approval_status = 'approved'
      and scheduled_at is not null
      and scheduled_at <= now()
      and (next_attempt_at is null or next_attempt_at <= now())
      and publish_attempts < 5
    order by scheduled_at asc
    for update skip locked
    limit greatest(1, least(batch_size, 500))
  ), updated as (
    update public.content_items item
    set status = 'publish_queued', queued_at = now(), updated_at = now()
    from candidates
    where item.id = candidates.id
    returning item.id, item.owner_id
  )
  insert into public.content_item_events(owner_id, content_item_id, event_type, actor_type, actor_id, details)
  select owner_id, id, 'publish_queued', 'scheduler', 'pg_cron', jsonb_build_object('queued_at', now())
  from updated;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

grant execute on function public.queue_due_content_items(integer) to service_role;

create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'zlink-content-publish-hourly') then
    perform cron.unschedule('zlink-content-publish-hourly');
  end if;
  perform cron.schedule(
    'zlink-content-publish-hourly',
    '0 * * * *',
    'select public.queue_due_content_items(100);'
  );
end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public)
    values ('social-assets', 'social-assets', true)
    on conflict (id) do update set public = excluded.public;
  end if;
end;
$$;
