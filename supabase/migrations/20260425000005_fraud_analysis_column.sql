alter table public.travel_expense_claims
  add column if not exists fraud_analysis jsonb;
