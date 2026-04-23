-- Fix: allow org creator to see their org before org_membership is created
-- Without this, INSERT ... RETURNING id fails (500) because the SELECT policy
-- blocks the newly inserted row (user not yet in org_memberships).

drop policy if exists "orgs_select" on public.organizations;
create policy "orgs_select" on public.organizations for select using (
  is_platform_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1 from public.org_memberships
    where user_id = auth.uid() and org_id = organizations.id and is_active = true
  )
);
