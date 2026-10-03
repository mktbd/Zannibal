-- Manual bKash order records (docs/MKTBD_SPEC.md sections 7-9).
--
-- Historical-integrity invariant: price_bdt_snapshot and
-- case_study_title_snapshot are captured at submission time and never
-- updated afterwards, so an Order stays meaningful even if the Case Study's
-- price changes, is unpublished, or is deleted. case_study_id is therefore
-- nullable with ON DELETE SET NULL, never CASCADE -- deleting a Case Study
-- must never delete or corrupt an Order.
--
-- Privacy invariant: there is deliberately no INSERT policy for anon/
-- authenticated roles below. Orders contain customer PII and payment
-- references; MKTBD_SPEC.md section 9 asks for a controlled server-side
-- mutation boundary for public order submission rather than an open client
-- INSERT grant, and that boundary (a Route Handler/Server Action using the
-- service-role client after validation) is future-prompt scope. Until it
-- exists, nothing outside the service role can write to this table at all.

create sequence public.order_number_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null check (btrim(customer_name) <> ''),
  customer_email text not null check (customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  bkash_number text not null check (btrim(bkash_number) <> ''),
  bkash_transaction_number text not null check (btrim(bkash_transaction_number) <> ''),
  case_study_id uuid references public.case_studies (id) on delete set null,
  case_study_title_snapshot text not null,
  price_bdt_snapshot numeric(10, 2) not null check (price_bdt_snapshot >= 0),
  status public.order_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_case_study_id_idx on public.orders (case_study_id);
create index orders_status_idx on public.orders (status);

-- Display-only identifier (e.g. "MKT-2026-000123"), generated server-side
-- so it never depends on the caller supplying one. Explicitly NOT a
-- security/auth token -- see MKTBD_SPEC.md section 8 -- it carries no
-- special access, since Orders have no public SELECT policy at all.
create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := 'MKT-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger orders_generate_order_number
  before insert on public.orders
  for each row execute function public.generate_order_number();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

-- Admin may read and update (e.g. change status pending -> fulfilled/
-- invalid) but not delete -- MKTBD_SPEC.md section 13 lists "read/update
-- Orders" for Admin, not delete, so no delete policy is created.
create policy "orders_select_admin"
  on public.orders for select
  using (public.is_admin());

create policy "orders_update_admin"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());
