-- Harga per fitur generator.
--
-- Menggantikan pengaturan.biaya_pesanan yang hanya mengatur satu fitur.
-- Harga 0 berarti gratis, dan fitur gratis tidak memerlukan akun sama sekali --
-- jadi membuka atau menutup sebuah fitur ke umum cukup mengubah angkanya.

create table if not exists public.fitur (
  kunci text primary key,
  nama text not null,
  keterangan text,
  harga integer not null default 0 check (harga >= 0),
  aktif boolean not null default true,
  urutan integer not null default 0
);

insert into public.fitur (kunci, nama, keterangan, harga, urutan) values
  ('setup', 'Setup Mikrotik Baru',
   'Script konfigurasi router dari kondisi default sampai siap pakai.', 0, 1),
  ('loadbalance', 'Load Balance PCC',
   'Script penggabungan dua ISP atau lebih dengan Per Connection Classifier.', 0, 2),
  ('failover', 'Fail Over',
   'Script perpindahan otomatis ke ISP cadangan.', 0, 3),
  ('login-page', 'Login Page Hotspot',
   'Satu pesanan halaman login hotspot berlisensi.', 25000, 4)
on conflict (kunci) do nothing;

update public.fitur f
set harga = (select nilai::integer from public.pengaturan where kunci = 'biaya_pesanan')
where f.kunci = 'login-page'
  and exists (select 1 from public.pengaturan where kunci = 'biaya_pesanan');

alter table public.fitur enable row level security;

-- Harga boleh dibaca pengunjung yang belum masuk: halaman depan perlu
-- menyebutkan biaya sebelum orang memutuskan mendaftar.
drop policy if exists "fitur_baca" on public.fitur;
create policy "fitur_baca" on public.fitur
  for select to anon, authenticated using (true);

drop policy if exists "fitur_kelola" on public.fitur;
create policy "fitur_kelola" on public.fitur
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.harga_fitur(p_kunci text)
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce((select harga from public.fitur where kunci = p_kunci and aktif), 0);
$fn$;

grant execute on function public.harga_fitur(text) to anon, authenticated;

-- Satu pintu untuk semua fitur berbayar. Harganya dibaca di dalam fungsi,
-- tidak pernah dikirim pemanggil.
create or replace function public.pakai_fitur(p_kunci text, p_keterangan text default null)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
  v_fitur public.fitur%rowtype;
  v_saldo integer;
begin
  select * into v_fitur from public.fitur where kunci = p_kunci;
  if not found then raise exception 'Fitur tidak dikenal: %', p_kunci; end if;
  if not v_fitur.aktif then raise exception 'Fitur % sedang tidak tersedia.', v_fitur.nama; end if;

  if v_fitur.harga = 0 then
    return coalesce((select sum(jumlah) from public.coin_transactions where user_id = v_user), 0)::integer;
  end if;

  if v_user is null then raise exception 'Belum masuk.'; end if;
  if not exists (select 1 from public.profiles where id = v_user and aktif) then
    raise exception 'Akun tidak aktif.';
  end if;

  if public.is_admin() then
    return coalesce((select sum(jumlah) from public.coin_transactions where user_id = v_user), 0)::integer;
  end if;

  perform 1 from public.coin_transactions where user_id = v_user for update;
  select coalesce(sum(jumlah), 0) into v_saldo
  from public.coin_transactions where user_id = v_user;

  if v_saldo < v_fitur.harga then
    raise exception 'Koin tidak cukup: butuh %, tersedia %', v_fitur.harga, v_saldo
      using errcode = 'P0001';
  end if;

  insert into public.coin_transactions (user_id, jumlah, jenis, keterangan)
  values (v_user, -v_fitur.harga, 'pemakaian', coalesce(p_keterangan, v_fitur.nama));

  return v_saldo - v_fitur.harga;
end;
$fn$;

revoke execute on function public.pakai_fitur(text, text) from anon, public;
grant execute on function public.pakai_fitur(text, text) to authenticated;

-- Satu tempat saja yang menentukan harga login page.
create or replace function public.biaya_pesanan()
returns integer language sql stable security definer set search_path = public as $fn$
  select public.harga_fitur('login-page');
$fn$;

notify pgrst, 'reload schema';
