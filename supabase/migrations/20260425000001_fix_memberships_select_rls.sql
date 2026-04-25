-- Fix: infinite recursion in memberships_select RLS caused by self-join on
-- org_memberships. When PostgREST joins org_memberships?select=...,organizations(*)
-- the policy's own EXISTS(SELECT FROM org_memberships) re-triggers itself → 500.
-- Solution: wrap the admin check in a SECURITY DEFINER function (bypasses RLS).

create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.org_memberships
    where user_id = _user_id and org_id = _org_id
      and role = 'admin' and is_active = true
  );
$$;

-- memberships: replace self-join with security-definer helper
drop policy if exists "memberships_select" on public.org_memberships;
create policy "memberships_select" on public.org_memberships for select using (
  is_platform_admin(auth.uid())
  or user_id = auth.uid()
  or is_org_admin(auth.uid(), org_memberships.org_id)
);

drop policy if exists "memberships_update" on public.org_memberships;
create policy "memberships_update" on public.org_memberships for update using (
  is_platform_admin(auth.uid())
  or is_org_admin(auth.uid(), org_memberships.org_id)
);

drop policy if exists "memberships_delete" on public.org_memberships;
create policy "memberships_delete" on public.org_memberships for delete using (
  is_platform_admin(auth.uid())
  or is_org_admin(auth.uid(), org_memberships.org_id)
);
