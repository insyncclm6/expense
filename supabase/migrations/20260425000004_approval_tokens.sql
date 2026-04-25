-- ── approval_tokens ───────────────────────────────────────────
create table if not exists public.approval_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       uuid unique not null default gen_random_uuid(),
  claim_id    uuid not null references public.travel_expense_claims(id) on delete cascade,
  approver_id uuid not null references public.profiles(id),
  action      text not null check (action in ('approve', 'reject')),
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '72 hours'),
  created_at  timestamptz not null default now()
);

create index if not exists idx_approval_tokens_claim  on public.approval_tokens(claim_id);
create index if not exists idx_approval_tokens_token  on public.approval_tokens(token);

-- approval_tokens are service-role only (no RLS needed for public access from edge functions)
alter table public.approval_tokens enable row level security;

-- Approvers can see their own tokens (for the dashboard, not strictly required)
create policy "approval_tokens_select" on public.approval_tokens for select
  using (approver_id = auth.uid());
