-- Sistem koin: pelanggan topup lewat Duitku, koin dipotong saat membuat
-- pesanan login page.
--
-- Tiga hal yang menentukan bentuk skema ini:
--
-- 1. Saldo TIDAK disimpan sebagai kolom. Saldo adalah jumlah dari buku besar
--    coin_transactions yang hanya bisa ditambah. Kolom saldo yang bisa ditimpa
--    akan rusak diam-diam pada dua permintaan bersamaan, dan setelah rusak
--    tidak ada cara merekonstruksi apa yang sebenarnya terjadi.
--
-- 2. Potong koin dan buat pesanan terjadi di dalam SATU fungsi, karena fungsi
--    plpgsql berjalan dalam satu transaksi. Kalau dipisah, cepat atau lambat
--    ada pelanggan yang koinnya terpotong tanpa pesanan, atau sebaliknya.
--
-- 3. Idempotensi callback dijaga database, bukan kode. Semua payment gateway
--    mengirim ulang callback yang sama; indeks unik pada topup_id membuat satu
--    topup mustahil dikredit dua kali, bahkan bila callbacknya datang serentak.

/* ------------------------------------------------------------------ *
 * Profil & peran
 * ------------------------------------------------------------------ */

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  wa text,
  peran text not null default 'pelanggan' check (peran in ('pelanggan', 'admin')),
  -- Admin bisa menonaktifkan akun tanpa menghapus riwayat koinnya.
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Dipakai di dalam kebijakan RLS tabel lain. security definer supaya
-- pembacaan profiles di sini tidak ikut tersaring RLS profiles itu sendiri --
-- tanpa itu kebijakannya memanggil dirinya sendiri tanpa henti.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and peran = 'admin' and aktif
  );
$fn$;

-- Setiap pengguna baru -- daftar sendiri maupun dibuatkan admin -- langsung
-- punya profil, jadi tidak ada akun tanpa peran.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, nama, wa)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'nama', ''),
    nullif(new.raw_user_meta_data ->> 'wa', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ------------------------------------------------------------------ *
 * Paket topup
 * ------------------------------------------------------------------ */

create table if not exists public.coin_packages (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  koin integer not null check (koin > 0),
  rupiah integer not null check (rupiah > 0),
  urutan integer not null default 0,
  aktif boolean not null default true
);

/* ------------------------------------------------------------------ *
 * Topup
 * ------------------------------------------------------------------ */

create table if not exists public.coin_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Nomor yang dikirim ke Duitku dan dipakai mencocokkan callback.
  merchant_order_id text not null unique,

  koin integer not null check (koin > 0),
  rupiah integer not null check (rupiah > 0),

  status text not null default 'menunggu'
    check (status in ('menunggu', 'lunas', 'gagal', 'kedaluwarsa')),

  reference text,
  payment_url text,
  metode text,

  -- Isi callback disimpan apa adanya untuk penelusuran sengketa pembayaran.
  raw_callback jsonb,
  dibayar_pada timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coin_topups_user_idx
  on public.coin_topups (user_id, created_at desc);

/* ------------------------------------------------------------------ *
 * Buku besar koin
 * ------------------------------------------------------------------ */

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Positif menambah, negatif mengurangi. Nol tidak berarti apa-apa.
  jumlah integer not null check (jumlah <> 0),

  jenis text not null
    check (jenis in ('topup', 'pemakaian', 'refund', 'penyesuaian', 'bonus')),

  keterangan text,
  topup_id uuid references public.coin_topups(id) on delete set null,
  -- Pesanan boleh dihapus tanpa menghapus jejak koinnya.
  order_id uuid references public.license_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists coin_tx_user_idx
  on public.coin_transactions (user_id, created_at desc);

-- Inti idempotensi: satu topup hanya boleh menghasilkan satu baris kredit.
-- Ditegakkan database, jadi callback berulang atau serentak tetap aman.
create unique index if not exists coin_tx_topup_sekali
  on public.coin_transactions (topup_id)
  where topup_id is not null;

/* ------------------------------------------------------------------ *
 * Kepemilikan pesanan
 * ------------------------------------------------------------------ */

alter table public.license_orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists license_orders_user_idx
  on public.license_orders (user_id, created_at desc);

/* ------------------------------------------------------------------ *
 * Saldo
 * ------------------------------------------------------------------ */

create or replace function public.saldo_koin(p_user uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_target uuid := coalesce(p_user, auth.uid());
begin
  -- Tanpa penjagaan ini, security definer membuat siapa pun bisa mengintip
  -- saldo orang lain hanya dengan menebak id-nya.
  if v_target is null then
    raise exception 'Belum masuk.';
  end if;
  if v_target <> auth.uid() and not public.is_admin() then
    raise exception 'Tidak berhak membaca saldo pengguna lain.';
  end if;

  return coalesce(
    (select sum(jumlah) from public.coin_transactions where user_id = v_target),
    0
  )::integer;
end;
$fn$;

/* ------------------------------------------------------------------ *
 * Kredit topup -- dipanggil hanya dari callback Duitku (service role)
 * ------------------------------------------------------------------ */

create or replace function public.kredit_topup(
  p_merchant_order_id text,
  p_reference text,
  p_metode text,
  p_raw jsonb
)
returns table (user_id uuid, koin integer, sudah_pernah boolean)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_topup public.coin_topups%rowtype;
begin
  -- Kunci barisnya lebih dulu: callback yang datang serentak akan mengantre di
  -- sini, bukan sama-sama lolos pemeriksaan status lalu mengkredit dua kali.
  select * into v_topup
  from public.coin_topups
  where merchant_order_id = p_merchant_order_id
  for update;

  if not found then
    raise exception 'Topup tidak dikenal: %', p_merchant_order_id;
  end if;

  if v_topup.status = 'lunas' then
    return query select v_topup.user_id, v_topup.koin, true;
    return;
  end if;

  update public.coin_topups
  set status = 'lunas',
      reference = coalesce(p_reference, reference),
      metode = coalesce(p_metode, metode),
      raw_callback = p_raw,
      dibayar_pada = now()
  where id = v_topup.id;

  insert into public.coin_transactions (user_id, jumlah, jenis, keterangan, topup_id)
  values (
    v_topup.user_id,
    v_topup.koin,
    'topup',
    'Topup ' || v_topup.koin || ' koin (' || p_merchant_order_id || ')',
    v_topup.id
  );

  return query select v_topup.user_id, v_topup.koin, false;
end;
$fn$;

/* ------------------------------------------------------------------ *
 * Tandai topup gagal / kedaluwarsa
 * ------------------------------------------------------------------ */

create or replace function public.gagalkan_topup(
  p_merchant_order_id text,
  p_status text,
  p_raw jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_status not in ('gagal', 'kedaluwarsa') then
    raise exception 'Status tidak valid: %', p_status;
  end if;

  -- Topup yang sudah lunas tidak boleh dibatalkan lewat jalur ini; koinnya
  -- sudah masuk buku besar dan pembatalannya harus lewat refund.
  update public.coin_topups
  set status = p_status, raw_callback = p_raw
  where merchant_order_id = p_merchant_order_id
    and status = 'menunggu';
end;
$fn$;

/* ------------------------------------------------------------------ *
 * Buat pesanan sekaligus potong koin
 * ------------------------------------------------------------------ */

create or replace function public.buat_pesanan_berbayar(
  p_pesanan jsonb,
  p_paket jsonb,
  p_biaya integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_saldo integer;
  v_order uuid;
  v_paket jsonb;
  v_posisi integer := 0;
begin
  if v_user is null then
    raise exception 'Belum masuk.';
  end if;
  if p_biaya < 0 then
    raise exception 'Biaya tidak boleh negatif.';
  end if;

  if not exists (select 1 from public.profiles where id = v_user and aktif) then
    raise exception 'Akun tidak aktif.';
  end if;

  -- Kunci buku besar pengguna ini sepanjang transaksi. Tanpa ini, dua
  -- permintaan bersamaan sama-sama membaca saldo cukup lalu keduanya lolos,
  -- dan saldo berakhir minus.
  perform 1 from public.coin_transactions where user_id = v_user for update;

  select coalesce(sum(jumlah), 0) into v_saldo
  from public.coin_transactions where user_id = v_user;

  if v_saldo < p_biaya then
    raise exception 'Koin tidak cukup: butuh %, tersedia %', p_biaya, v_saldo
      using errcode = 'P0001';
  end if;

  insert into public.license_orders (
    user_id, nama_usaha, kontak_nama, catatan, template_slug,
    merek_a, merek_b, merek_spasi, tagline, footer_tagline,
    wa_nomor, wa_tampil, warna,
    bank_nama, bank_nomor, bank_atas_nama,
    logo_data_url, bg_data_url, status
  )
  select
    v_user,
    p_pesanan ->> 'nama_usaha',
    p_pesanan ->> 'kontak_nama',
    p_pesanan ->> 'catatan',
    p_pesanan ->> 'template_slug',
    p_pesanan ->> 'merek_a',
    coalesce(p_pesanan ->> 'merek_b', ''),
    coalesce((p_pesanan ->> 'merek_spasi')::boolean, true),
    coalesce(p_pesanan ->> 'tagline', 'INTERNET HOTSPOT VOUCHER'),
    coalesce(p_pesanan ->> 'footer_tagline', 'Internet Hotspot Voucher'),
    p_pesanan ->> 'wa_nomor',
    p_pesanan ->> 'wa_tampil',
    coalesce(p_pesanan -> 'warna', '{}'::jsonb),
    p_pesanan ->> 'bank_nama',
    p_pesanan ->> 'bank_nomor',
    p_pesanan ->> 'bank_atas_nama',
    p_pesanan ->> 'logo_data_url',
    p_pesanan ->> 'bg_data_url',
    'draft'
  returning id into v_order;

  for v_paket in select * from jsonb_array_elements(coalesce(p_paket, '[]'::jsonb))
  loop
    insert into public.license_packages (
      order_id, posisi, nama, harga, meta_atas, meta_bawah, warna, rank
    )
    values (
      v_order,
      v_posisi,
      v_paket ->> 'nama',
      v_paket ->> 'harga',
      coalesce(v_paket ->> 'meta_atas', ''),
      coalesce(v_paket ->> 'meta_bawah', ''),
      coalesce(v_paket ->> 'warna', '#3ea6ff'),
      v_paket ->> 'rank'
    );
    v_posisi := v_posisi + 1;
  end loop;

  if p_biaya > 0 then
    insert into public.coin_transactions (user_id, jumlah, jenis, keterangan, order_id)
    values (v_user, -p_biaya, 'pemakaian',
            'Pesanan ' || coalesce(p_pesanan ->> 'nama_usaha', '-'), v_order);
  end if;

  return v_order;
end;
$fn$;

/* ------------------------------------------------------------------ *
 * Penyesuaian & refund oleh admin
 * ------------------------------------------------------------------ */

create or replace function public.sesuaikan_koin(
  p_user uuid,
  p_jumlah integer,
  p_jenis text,
  p_keterangan text
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin.';
  end if;
  if p_jenis not in ('refund', 'penyesuaian', 'bonus') then
    raise exception 'Jenis tidak valid: %', p_jenis;
  end if;
  if p_jumlah = 0 then
    raise exception 'Jumlah tidak boleh nol.';
  end if;

  insert into public.coin_transactions (user_id, jumlah, jenis, keterangan)
  values (p_user, p_jumlah, p_jenis, p_keterangan);

  return coalesce(
    (select sum(jumlah) from public.coin_transactions where user_id = p_user), 0
  )::integer;
end;
$fn$;

/* ------------------------------------------------------------------ *
 * Memulai topup
 *
 * Jumlah koin dan rupiah diambil dari tabel paket DI DALAM fungsi ini, bukan
 * dari parameter. Kalau keduanya boleh dikirim pemanggil, siapa pun bisa
 * membuat baris topup 1000 koin seharga seribu rupiah lalu membayarnya.
 * ------------------------------------------------------------------ */

create or replace function public.buat_topup(
  p_merchant_order_id text,
  p_paket_id uuid
)
returns table (koin integer, rupiah integer, nama text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_paket public.coin_packages%rowtype;
begin
  if v_user is null then
    raise exception 'Belum masuk.';
  end if;
  if not exists (select 1 from public.profiles where id = v_user and aktif) then
    raise exception 'Akun tidak aktif.';
  end if;

  select * into v_paket from public.coin_packages
  where id = p_paket_id and aktif;

  if not found then
    raise exception 'Paket topup tidak tersedia.';
  end if;

  insert into public.coin_topups (user_id, merchant_order_id, koin, rupiah)
  values (v_user, p_merchant_order_id, v_paket.koin, v_paket.rupiah);

  return query select v_paket.koin, v_paket.rupiah, v_paket.nama;
end;
$fn$;

/* Menyimpan hasil dari Duitku. Hanya boleh menyentuh baris milik sendiri yang
   masih menunggu -- tidak bisa dipakai mengubah topup yang sudah lunas. */
create or replace function public.set_pembayaran_topup(
  p_merchant_order_id text,
  p_reference text,
  p_payment_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.coin_topups
  set reference = coalesce(p_reference, reference),
      payment_url = coalesce(p_payment_url, payment_url)
  where merchant_order_id = p_merchant_order_id
    and user_id = auth.uid()
    and status = 'menunggu';
end;
$fn$;

/* Dipakai saat Duitku menolak permintaan, supaya barisnya tidak menggantung
   sebagai "menunggu" selamanya. */
create or replace function public.batalkan_topup_sendiri(p_merchant_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.coin_topups
  set status = 'gagal'
  where merchant_order_id = p_merchant_order_id
    and user_id = auth.uid()
    and status = 'menunggu';
end;
$fn$;

/* ------------------------------------------------------------------ *
 * RLS
 * ------------------------------------------------------------------ */

alter table public.profiles enable row level security;
alter table public.coin_packages enable row level security;
alter table public.coin_topups enable row level security;
alter table public.coin_transactions enable row level security;

drop policy if exists "profiles_baca_sendiri" on public.profiles;
create policy "profiles_baca_sendiri" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_ubah_sendiri" on public.profiles;
create policy "profiles_ubah_sendiri" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  -- Peran tidak boleh dinaikkan sendiri; hanya admin yang boleh menyentuhnya.
  with check (public.is_admin() or (id = auth.uid() and peran = 'pelanggan'));

drop policy if exists "paket_koin_baca" on public.coin_packages;
create policy "paket_koin_baca" on public.coin_packages
  for select to authenticated using (aktif or public.is_admin());

drop policy if exists "paket_koin_kelola" on public.coin_packages;
create policy "paket_koin_kelola" on public.coin_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "topup_baca_sendiri" on public.coin_topups;
create policy "topup_baca_sendiri" on public.coin_topups
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Sengaja TIDAK ada kebijakan insert/update untuk topup maupun buku besar.
-- Keduanya hanya boleh ditulis lewat fungsi security definer di atas, yang
-- dipanggil server. Klien yang mencoba menulis langsung akan ditolak.
drop policy if exists "koin_baca_sendiri" on public.coin_transactions;
create policy "koin_baca_sendiri" on public.coin_transactions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

/* --- Pesanan: dulu semua pengguna login bisa membaca semuanya --------- *
 * Aman selagi hanya admin yang bisa masuk. Begitu pelanggan boleh daftar
 * sendiri, kebijakan lama itu membuka nomor WhatsApp, identity router, dan
 * kunci lisensi milik pelanggan lain.                                    */

drop policy if exists "license_orders_admin" on public.license_orders;
drop policy if exists "license_packages_admin" on public.license_packages;

drop policy if exists "pesanan_milik_sendiri" on public.license_orders;
create policy "pesanan_milik_sendiri" on public.license_orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "pesanan_ubah_sendiri" on public.license_orders;
create policy "pesanan_ubah_sendiri" on public.license_orders
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "pesanan_hapus_admin" on public.license_orders;
create policy "pesanan_hapus_admin" on public.license_orders
  for delete to authenticated using (public.is_admin());

-- Insert hanya lewat buat_pesanan_berbayar(), supaya pesanan tidak pernah ada
-- tanpa koin terpotong.

drop policy if exists "paket_ikut_pesanan" on public.license_packages;
create policy "paket_ikut_pesanan" on public.license_packages
  for all to authenticated
  using (exists (
    select 1 from public.license_orders o
    where o.id = license_packages.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.license_orders o
    where o.id = license_packages.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  ));

/* ------------------------------------------------------------------ *
 * Hak panggil fungsi
 * ------------------------------------------------------------------ */

revoke all on function public.kredit_topup(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.gagalkan_topup(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.kredit_topup(text, text, text, jsonb) to service_role;
grant execute on function public.gagalkan_topup(text, text, jsonb) to service_role;

grant execute on function public.saldo_koin(uuid) to authenticated;
grant execute on function public.buat_pesanan_berbayar(jsonb, jsonb, integer) to authenticated;
grant execute on function public.sesuaikan_koin(uuid, integer, text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.buat_topup(text, uuid) to authenticated;
grant execute on function public.set_pembayaran_topup(text, text, text) to authenticated;
grant execute on function public.batalkan_topup_sendiri(text) to authenticated;

/* ------------------------------------------------------------------ *
 * Isi awal paket topup -- ubah sendiri lewat panel admin nanti
 * ------------------------------------------------------------------ */

insert into public.coin_packages (nama, koin, rupiah, urutan)
select * from (values
  ('Hemat',   25,   25000, 1),
  ('Standar', 60,   55000, 2),
  ('Hemat+',  150, 130000, 3)
) as v(nama, koin, rupiah, urutan)
where not exists (select 1 from public.coin_packages);

notify pgrst, 'reload schema';
