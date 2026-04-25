-- Drop old orphaned OTP table from the deleted registration module
drop table if exists public.public_otp_verifications;

-- New OTP verifications: email + WhatsApp stored together, verified atomically
create table if not exists public.otp_verifications (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  phone      text        not null,
  email_otp  text        not null,
  phone_otp  text        not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists otp_verifications_email_idx on public.otp_verifications (email);

-- No RLS — accessed only via service role in edge functions
alter table public.otp_verifications disable row level security;
