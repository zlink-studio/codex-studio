alter table if exists public.agents
  add column if not exists agent_role text not null default 'worker',
  add column if not exists skills text[] not null default '{}',
  add column if not exists workload integer not null default 0,
  add column if not exists last_heartbeat_at timestamptz;

alter table if exists public.tasks
  add column if not exists board_status text not null default 'todo',
  add column if not exists review_status text not null default 'not_required',
  add column if not exists estimated_cost numeric not null default 0,
  add column if not exists actual_cost numeric not null default 0,
  add column if not exists parent_task_id uuid references public.tasks(id) on delete set null,
  add column if not exists sort_order integer not null default 0;

create table if not exists public.agent_runs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'queued',
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  cost numeric not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_logs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quality_reviews (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'pending',
  score integer,
  checklist jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists tasks_owner_board_status_idx on public.tasks(owner_id, board_status, sort_order);
create index if not exists agent_runs_owner_status_idx on public.agent_runs(owner_id, status);
create index if not exists task_logs_task_created_idx on public.task_logs(task_id, created_at);
create index if not exists quality_reviews_owner_status_idx on public.quality_reviews(owner_id, status);

alter table public.agent_runs enable row level security;
alter table public.task_logs enable row level security;
alter table public.quality_reviews enable row level security;

drop policy if exists "Owners manage agent runs" on public.agent_runs;
create policy "Owners manage agent runs" on public.agent_runs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage task logs" on public.task_logs;
create policy "Owners manage task logs" on public.task_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage quality reviews" on public.quality_reviews;
create policy "Owners manage quality reviews" on public.quality_reviews
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
