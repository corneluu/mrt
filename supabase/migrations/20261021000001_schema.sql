-- MRT site: content, forms, admin access, trash and activity log.
-- Column names stay Romanian to match the Astro content schemas in src/content.config.ts.

create extension if not exists pg_cron;

-- ───────────── Admin access ─────────────
-- Sign-ups are disabled in the dashboard, but access is still gated on this list
-- so an account created by mistake gets no rights.
create table public.admini (
  email text primary key check (email = lower(email)),
  creat_la timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admini
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Everyone who already has an account when this runs becomes an admin.
insert into public.admini (email)
select lower(email) from auth.users where email is not null
on conflict do nothing;

-- ───────────── Shared helpers ─────────────
create or replace function public.set_actualizat_la()
returns trigger language plpgsql as $$
begin
  new.actualizat_la = now();
  return new;
end;
$$;

-- ───────────── Content tables ─────────────
create table public.proiecte (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titlu text not null,
  descriere text not null,
  continut text not null default '',            -- HTML from the admin rich-text editor
  imagine text not null,
  categorie text not null check (categorie in ('educatie','sanatate','comunitate','social','tineret')),
  status text not null check (status in ('activ','finalizat','planificat')),
  data_start date not null,
  data_final date,
  beneficiari integer check (beneficiari >= 0),
  locatie text,
  parteneri text[] not null default '{}',
  publicat boolean not null default true,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  sters_la timestamptz
);

create table public.noutati (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titlu text not null,
  descriere text not null,
  continut text not null default '',
  imagine text not null,
  data date not null default current_date,
  autor text not null default 'Echipa MRT',
  categorie text not null check (categorie in ('eveniment','stire','raport','comunitate')),
  tags text[] not null default '{}',
  publicat boolean not null default true,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  sters_la timestamptz
);

create table public.echipa (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  rol text not null,
  imagine text,
  bio text,
  ordine integer not null default 0,
  publicat boolean not null default true,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  sters_la timestamptz
);

create table public.voluntari (like public.echipa including all);

create table public.parteneri (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  logo text not null,
  website text check (website is null or website ~ '^https?://'),
  tip text not null check (tip in ('partener','sponsor','institutional')),
  descriere text,
  ordine integer not null default 0,
  publicat boolean not null default true,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  sters_la timestamptz
);

create table public.galerie (
  id uuid primary key default gen_random_uuid(),
  imagine text not null,
  titlu text not null default '',
  alt text not null default '',
  ordine integer not null default 0,
  publicat boolean not null default true,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  sters_la timestamptz
);

-- Key/value site settings: contact, legal and social data (one row per group).
create table public.setari (
  cheie text primary key,
  valoare jsonb not null default '{}',
  actualizat_la timestamptz not null default now()
);

-- Per-form field config: { "<field>": { "label", "placeholder", "required", "hidden", "options"? } }
create table public.setari_formulare (
  tip_formular text primary key check (tip_formular in ('contact','voluntariat','parteneriat')),
  campuri jsonb not null default '{}',
  actualizat_la timestamptz not null default now()
);

-- ───────────── Form submissions ─────────────
create table public.mesaje (
  id uuid primary key default gen_random_uuid(),
  tip_formular text not null check (tip_formular in ('contact','voluntariat','parteneriat')),
  nume text not null check (char_length(nume) between 2 and 100),
  email text not null check (char_length(email) <= 120),
  telefon text check (char_length(telefon) <= 25),
  mesaj text not null check (char_length(mesaj) between 10 and 3000),
  extra jsonb not null default '{}',              -- age, occupation, availability, ...
  pagina text,
  ip_hash text,                                    -- salted hash, only for rate limiting
  status text not null default 'nou' check (status in ('nou','in_lucru','rezolvat')),
  note text not null default '',
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  sters_la timestamptz
);
create index mesaje_creat_la_idx on public.mesaje (creat_la desc);
create index mesaje_ip_idx on public.mesaje (ip_hash, creat_la desc);

-- ───────────── Activity log ─────────────
create table public.jurnal (
  id bigint generated always as identity primary key,
  email text,
  actiune text not null,          -- creare | modificare | stergere | restaurare | stergere_definitiva
  tabel text not null,
  inregistrare_id text,
  rezumat text,
  creat_la timestamptz not null default now()
);
create index jurnal_creat_la_idx on public.jurnal (creat_la desc);

create or replace function public.log_activitate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  act text;
begin
  -- Only log admin actions; public form inserts and cron cleanups have no user email.
  if auth.jwt() ->> 'email' is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  act := case
    when tg_op = 'INSERT' then 'creare'
    when tg_op = 'DELETE' then 'stergere_definitiva'
    when (to_jsonb(old) ->> 'sters_la') is null and (rec ->> 'sters_la') is not null then 'stergere'
    when (to_jsonb(old) ->> 'sters_la') is not null and (rec ->> 'sters_la') is null then 'restaurare'
    else 'modificare'
  end;

  insert into public.jurnal (email, actiune, tabel, inregistrare_id, rezumat)
  values (
    auth.jwt() ->> 'email',
    act,
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'cheie', rec ->> 'tip_formular', rec ->> 'email'),
    left(coalesce(rec ->> 'titlu', rec ->> 'nume', rec ->> 'cheie', rec ->> 'tip_formular', rec ->> 'email', ''), 120)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ───────────── Triggers, RLS ─────────────
do $$
declare t text;
begin
  -- updated-at + activity log on every editable table
  foreach t in array array['proiecte','noutati','echipa','voluntari','parteneri','galerie','setari','setari_formulare','mesaje'] loop
    execute format('create trigger %I_actualizat before update on public.%I for each row execute function public.set_actualizat_la()', t, t);
    execute format('create trigger %I_jurnal after insert or update or delete on public.%I for each row execute function public.log_activitate()', t, t);
  end loop;
  execute 'create trigger admini_jurnal after insert or delete on public.admini for each row execute function public.log_activitate()';

  -- Public content: anyone reads published, non-deleted rows; admins do everything.
  foreach t in array array['proiecte','noutati','echipa','voluntari','parteneri','galerie'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public citeste publicate" on public.%I for select to anon, authenticated using (publicat and sters_la is null)', t);
    execute format('create policy "admin total" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- Settings: public read (the site needs them at build time), admin write.
  foreach t in array array['setari','setari_formulare'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public citeste" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin total" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- Private tables: admins only. Form inserts come from the submit-form edge function (service role).
  foreach t in array array['mesaje','admini'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin total" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Activity log: admins read only; rows are written by the trigger function.
alter table public.jurnal enable row level security;
create policy "admin citeste" on public.jurnal for select to authenticated using (public.is_admin());

-- Never let the last admin be removed (would lock everyone out).
create or replace function public.pastreaza_un_admin()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.admini) = 0 then
    raise exception 'Trebuie să rămână cel puțin un administrator.';
  end if;
  return old;
end;
$$;
create trigger admini_minim after delete on public.admini
  for each row execute function public.pastreaza_un_admin();

-- ───────────── Storage (photos) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp','image/jpeg','image/png','image/svg+xml'])
on conflict (id) do nothing;

create policy "media citire publica" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy "media admin incarcare" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy "media admin modificare" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy "media admin stergere" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ───────────── Trash: purge after 30 days (daily, 02:30 UTC) ─────────────
create or replace function public.goleste_cosul()
returns void language plpgsql security definer set search_path = public as $$
declare t text;
begin
  foreach t in array array['proiecte','noutati','echipa','voluntari','parteneri','galerie','mesaje'] loop
    execute format('delete from public.%I where sters_la < now() - interval ''30 days''', t);
  end loop;
end;
$$;
revoke execute on function public.goleste_cosul() from public, anon, authenticated;

select cron.schedule('goleste-cosul', '30 2 * * *', 'select public.goleste_cosul()');
