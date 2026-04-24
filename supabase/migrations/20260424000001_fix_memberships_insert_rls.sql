-- Fix: allow org creator to insert their own first membership (bootstrap)
-- The original policy required the user to already be an org admin to insert —
-- a circular dependency that blocked self-registration entirely.

drop policy if exists "memberships_insert" on public.org_memberships;
create policy "memberships_insert" on public.org_memberships for insert with check (
  is_platform_admin(auth.uid())
  -- existing org admin can add new members
  or exists (
    select 1 from public.org_memberships m2
    where m2.user_id = auth.uid() and m2.org_id = org_memberships.org_id
      and m2.role = 'admin' and m2.is_active = true
  )
  -- org creator can insert their own first membership (no chicken-and-egg)
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.organizations
      where id = org_memberships.org_id and created_by = auth.uid()
    )
  )
);
