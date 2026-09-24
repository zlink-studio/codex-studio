alter table public.tool_connections
  add column if not exists credential_ciphertext text,
  add column if not exists credential_key_version text,
  add column if not exists credential_status text not null default 'unconfigured',
  add column if not exists updated_at timestamptz not null default now();

update public.tool_connections
set credential_status = case
  when config ?| array[
    'api_key', 'apiKey', 'access_token', 'accessToken', 'refresh_token', 'refreshToken',
    'secret', 'client_secret', 'clientSecret', 'password', 'private_key', 'privateKey'
  ] then 'needs_rotation'
  else credential_status
end
where credential_ciphertext is null;

alter table public.tool_connections
  drop constraint if exists tool_connections_credential_status_check;
alter table public.tool_connections
  add constraint tool_connections_credential_status_check
  check (credential_status in ('unconfigured', 'active', 'needs_rotation', 'revoked'));

-- Existing rows are not silently destroyed. New/updated rows cannot place common
-- secret fields in public config; rows marked needs_rotation must be rotated via
-- the application API, which replaces them with AES-GCM ciphertext.
alter table public.tool_connections
  drop constraint if exists tool_connections_public_config_check;
alter table public.tool_connections
  add constraint tool_connections_public_config_check
  check (not (config ?| array[
    'api_key', 'apiKey', 'access_token', 'accessToken', 'refresh_token', 'refreshToken',
    'secret', 'client_secret', 'clientSecret', 'password', 'private_key', 'privateKey'
  ])) not valid;

create table if not exists public.credential_access_logs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  tool_connection_id uuid references public.tool_connections(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  actor_type text not null,
  actor_id text not null,
  purpose text not null,
  access_type text not null default 'decrypt',
  success boolean not null,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credential_access_logs_actor_type_check
    check (actor_type in ('system', 'agent', 'owner', 'workflow')),
  constraint credential_access_logs_access_type_check
    check (access_type in ('decrypt', 'rotate', 'revoke'))
);

create index if not exists credential_access_logs_owner_created_idx
  on public.credential_access_logs(owner_id, created_at desc);
create index if not exists credential_access_logs_connection_created_idx
  on public.credential_access_logs(tool_connection_id, created_at desc);

alter table public.credential_access_logs enable row level security;

drop policy if exists "Owners read credential access logs" on public.credential_access_logs;
create policy "Owners read credential access logs" on public.credential_access_logs
  for select using (auth.uid() = owner_id);

-- Ciphertext and audit writes are server-only. Authenticated users may read
-- connection metadata and their own audit rows, but never the encrypted column.
revoke all privileges on public.tool_connections from anon, authenticated;
grant select (
  id, owner_id, type, name, config, is_enabled, credential_status,
  credential_key_version, last_checked_at, created_at, updated_at
) on public.tool_connections to authenticated;

revoke all privileges on public.credential_access_logs from anon, authenticated;
grant select on public.credential_access_logs to authenticated;
grant all privileges on public.tool_connections, public.credential_access_logs to service_role;

