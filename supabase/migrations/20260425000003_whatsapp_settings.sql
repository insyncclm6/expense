-- ── whatsapp_settings ─────────────────────────────────────────
create table if not exists public.whatsapp_settings (
  id                    uuid primary key default gen_random_uuid(),
  exotel_sid            text,
  exotel_api_key        text,
  exotel_api_token      text,
  exotel_subdomain      text not null default 'api.exotel.com',
  whatsapp_source_number text,
  waba_id               text,
  is_active             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.whatsapp_settings enable row level security;

-- Only admins can read/write WhatsApp settings
create policy "whatsapp_settings_admin" on public.whatsapp_settings
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create or replace trigger whatsapp_settings_updated_at
  before update on public.whatsapp_settings
  for each row execute function public.set_updated_at();
