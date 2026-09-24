alter table public.tasks
  add column if not exists approval_level text not null default 'L0';

alter table public.skills
  add column if not exists approval_level text not null default 'L0';

alter table public.tasks drop constraint if exists tasks_approval_level_check;
alter table public.tasks
  add constraint tasks_approval_level_check check (approval_level in ('L0', 'L1', 'L2', 'L3'));

alter table public.skills drop constraint if exists skills_approval_level_check;
alter table public.skills
  add constraint skills_approval_level_check check (approval_level in ('L0', 'L1', 'L2', 'L3'));

update public.tasks
set approval_level = case
  when risk_level = 'critical' then 'L3'
  when risk_level = 'high' or approval_required then 'L2'
  else approval_level
end;

update public.skills
set approval_level = case
  when lower(coalesce(name, '') || ' ' || coalesce(slug, '') || ' ' || coalesce(description, '') || ' ' || coalesce(instructions, ''))
    ~ '(退款|refund|转账|credential|预算熔断|budget fuse|账户授权|权限变更)' then 'L3'
  when lower(coalesce(name, '') || ' ' || coalesce(slug, '') || ' ' || coalesce(description, '') || ' ' || coalesce(instructions, ''))
    ~ '(发布|publish|发邮件|send email|广告投放|launch ad|加预算|increase budget|调价|change price)' then 'L2'
  when skill_type = 'action' then 'L1'
  else approval_level
end;

create index if not exists tasks_owner_approval_level_idx
  on public.tasks(owner_id, approval_level, approval_status);

create index if not exists skills_owner_approval_level_idx
  on public.skills(owner_id, approval_level, enabled);
