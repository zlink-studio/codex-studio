alter table public.projects
  add column if not exists brief text,
  add column if not exists risk_level text not null default 'low',
  add column if not exists agent_ids jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists assigned_agent_role text,
  add column if not exists suggested_skills jsonb not null default '[]'::jsonb,
  add column if not exists model_policy text,
  add column if not exists input_requirements text,
  add column if not exists output_requirements text,
  add column if not exists result text,
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_level text not null default 'L0',
  add column if not exists used_memory_ids jsonb not null default '[]'::jsonb,
  add column if not exists model_run jsonb,
  add column if not exists rework_count integer not null default 0;

create table if not exists public.skills (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null,
  category text not null,
  description text not null,
  instructions text not null,
  input_schema jsonb,
  output_schema jsonb,
  risk_level text not null default 'low',
  skill_type text not null default 'knowledge',
  required_tools text[] not null default '{}',
  required_memory_types text[] not null default '{}',
  approval_required boolean not null default false,
  approval_level text not null default 'L0',
  source text not null default 'custom',
  source_url text,
  license text,
  version text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_skills (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  agent_id text not null,
  skill_id text not null,
  priority text not null default 'secondary',
  enabled boolean not null default true,
  config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_runs (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  skill_id text not null,
  agent_id text,
  task_id text,
  agent_run_id text,
  model_run_id text,
  status text not null default 'success',
  input jsonb,
  output jsonb,
  error text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_reviews (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  skill_id text not null,
  review_status text not null default 'pending',
  risk_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.deliverables (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  project_id text not null,
  task_id text,
  agent_id text,
  title text not null,
  type text not null,
  file_path text,
  content text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_logs (
  id text primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  project_id text not null,
  event_type text not null,
  title text not null,
  description text not null,
  related_task_id text,
  related_agent_id text,
  related_deliverable_id text,
  created_at timestamptz not null default now()
);

create index if not exists skills_owner_enabled_idx on public.skills(owner_id, enabled);
create index if not exists agent_skills_owner_agent_idx on public.agent_skills(owner_id, agent_id);
create index if not exists skill_runs_owner_task_idx on public.skill_runs(owner_id, task_id, created_at);
create index if not exists skill_reviews_owner_status_idx on public.skill_reviews(owner_id, review_status);
create index if not exists deliverables_owner_project_idx on public.deliverables(owner_id, project_id, created_at);
create index if not exists deliverables_owner_status_idx on public.deliverables(owner_id, status);
create index if not exists project_logs_owner_project_idx on public.project_logs(owner_id, project_id, created_at);

alter table public.skills enable row level security;
alter table public.agent_skills enable row level security;
alter table public.skill_runs enable row level security;
alter table public.skill_reviews enable row level security;
alter table public.deliverables enable row level security;
alter table public.project_logs enable row level security;

drop policy if exists "Owners manage skills" on public.skills;
create policy "Owners manage skills" on public.skills
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage agent skills" on public.agent_skills;
create policy "Owners manage agent skills" on public.agent_skills
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage skill runs" on public.skill_runs;
create policy "Owners manage skill runs" on public.skill_runs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage skill reviews" on public.skill_reviews;
create policy "Owners manage skill reviews" on public.skill_reviews
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage deliverables" on public.deliverables;
create policy "Owners manage deliverables" on public.deliverables
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage project logs" on public.project_logs;
create policy "Owners manage project logs" on public.project_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
