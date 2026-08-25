-- Generator lisensi login page hotspot.
--
-- Satu baris license_orders = satu pesanan pelanggan. Berkas login.html tidak
-- disimpan di sini; yang disimpan adalah bahan untuk mencetaknya, sehingga
-- pesanan lama bisa dicetak ulang kapan saja tanpa menyunting HTML.
--
-- TIDAK ADA kebijakan untuk anon. Tabel ini berisi nomor telepon pelanggan,
-- identity router, dan kunci lisensi — semuanya hanya untuk admin yang login.
-- Berbeda dari tabel katalog/blog yang memang tampil di situs publik.

create table if not exists public.license_orders (
  id uuid primary key default gen_random_uuid(),

  -- Nomor pendek untuk disebut di percakapan WhatsApp ("pesanan #14").
  nomor bigint generated always as identity,

  nama_usaha text not null,
  kontak_nama text,
  catatan text,

  template_slug text not null,

  -- Logo teks dipecah dua supaya bisa dua warna, seperti MIKRO|SETTING.
  merek_a text not null,
  merek_b text not null default '',
  merek_spasi boolean not null default true,
  tagline text not null default 'INTERNET HOTSPOT VOUCHER',
  footer_tagline text not null default 'Internet Hotspot Voucher',

  -- wa_nomor untuk tautan (62...), wa_tampil untuk yang terbaca di layar.
  wa_nomor text not null,
  wa_tampil text not null,

  -- kunci slot warna -> #rrggbb; kosong berarti pakai bawaan tema.
  warna jsonb not null default '{}'::jsonb,

  bank_nama text,
  bank_nomor text,
  bank_atas_nama text,

  -- Gambar disimpan sebagai data URI, lalu ditulis jadi berkas img/logo.png
  -- dan img/bg.jpg di dalam zip. Halaman login tidak boleh menunjuk ke alamat
  -- luar: pelanggan belum punya internet saat membukanya.
  logo_data_url text,
  bg_data_url text,

  -- Diisi setelah pembeli melaporkan ID ROUTER dari layar "LISENSI TIDAK AKTIF".
  router_identity text,
  lisensi_kunci text,
  lisensi_terbit_pada timestamptz,

  -- draft -> terkirim -> aktif; batal untuk pesanan yang tidak jadi.
  status text not null default 'draft'
    check (status in ('draft', 'terkirim', 'aktif', 'batal')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists license_orders_nomor_idx on public.license_orders (nomor);
create index if not exists license_orders_status_idx on public.license_orders (status, created_at desc);

create table if not exists public.license_packages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.license_orders(id) on delete cascade,
  posisi int not null default 0,
  nama text not null,
  harga text not null,
  meta_atas text not null default 'Masa aktif',
  meta_bawah text not null default '',
  warna text not null default '#3ea6ff',
  -- Pita tingkatan khas tema (KAGE, MYTHIC, ...). Kosong = pakai bawaan tema.
  rank text
);

create index if not exists license_packages_order_idx on public.license_packages (order_id, posisi);

alter table public.license_orders enable row level security;
alter table public.license_packages enable row level security;

drop policy if exists "license_orders_admin" on public.license_orders;
create policy "license_orders_admin" on public.license_orders
  for all to authenticated using (true) with check (true);

drop policy if exists "license_packages_admin" on public.license_packages;
create policy "license_packages_admin" on public.license_packages
  for all to authenticated using (true) with check (true);

drop trigger if exists license_orders_set_updated_at on public.license_orders;
create trigger license_orders_set_updated_at
  before update on public.license_orders
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
