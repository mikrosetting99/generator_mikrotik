-- Biaya pesanan tidak boleh datang dari pemanggil.
--
-- Versi pertama buat_pesanan_berbayar() menerima p_biaya sebagai parameter.
-- Artinya siapa pun yang login bisa memanggil fungsinya langsung lewat
-- PostgREST dengan p_biaya = 0 dan membuat pesanan gratis -- seluruh sistem
-- koin jadi tidak ada gunanya. Biayanya kini dibaca dari tabel pengaturan di
-- dalam fungsi, dan tanda tangan lama dibuang supaya tidak ada jalan memanggil
-- versi yang masih menerimanya dari luar.
--
-- Sekalian: penerbit lisensi tidak membayar dirinya sendiri.

create table if not exists public.pengaturan (
  kunci text primary key,
  nilai text not null,
  keterangan text
);

insert into public.pengaturan (kunci, nilai, keterangan)
values ('biaya_pesanan', '25', 'Koin yang dipotong setiap membuat satu pesanan login page.')
on conflict (kunci) do nothing;

alter table public.pengaturan enable row level security;

drop policy if exists "pengaturan_baca" on public.pengaturan;
create policy "pengaturan_baca" on public.pengaturan
  for select to authenticated using (true);

drop policy if exists "pengaturan_kelola" on public.pengaturan;
create policy "pengaturan_kelola" on public.pengaturan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.biaya_pesanan()
returns integer language sql stable security definer set search_path = public as $fn$
  select coalesce((select nilai::integer from public.pengaturan where kunci = 'biaya_pesanan'), 25);
$fn$;

drop function if exists public.buat_pesanan_berbayar(jsonb, jsonb, integer);

create or replace function public.buat_pesanan_berbayar(p_pesanan jsonb, p_paket jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
  v_biaya integer;
  v_saldo integer;
  v_order uuid;
  v_paket jsonb;
  v_posisi integer := 0;
begin
  if v_user is null then raise exception 'Belum masuk.'; end if;
  if not exists (select 1 from public.profiles where id = v_user and aktif) then
    raise exception 'Akun tidak aktif.';
  end if;

  v_biaya := case when public.is_admin() then 0 else public.biaya_pesanan() end;

  if v_biaya > 0 then
    perform 1 from public.coin_transactions where user_id = v_user for update;
    select coalesce(sum(jumlah), 0) into v_saldo
    from public.coin_transactions where user_id = v_user;
    if v_saldo < v_biaya then
      raise exception 'Koin tidak cukup: butuh %, tersedia %', v_biaya, v_saldo
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.license_orders (
    user_id, nama_usaha, kontak_nama, catatan, template_slug,
    merek_a, merek_b, merek_spasi, tagline, footer_tagline,
    wa_nomor, wa_tampil, warna, bank_nama, bank_nomor, bank_atas_nama,
    logo_data_url, bg_data_url, status
  )
  select v_user,
    p_pesanan ->> 'nama_usaha', p_pesanan ->> 'kontak_nama', p_pesanan ->> 'catatan',
    p_pesanan ->> 'template_slug', p_pesanan ->> 'merek_a',
    coalesce(p_pesanan ->> 'merek_b',''),
    coalesce((p_pesanan ->> 'merek_spasi')::boolean, true),
    coalesce(p_pesanan ->> 'tagline','INTERNET HOTSPOT VOUCHER'),
    coalesce(p_pesanan ->> 'footer_tagline','Internet Hotspot Voucher'),
    p_pesanan ->> 'wa_nomor', p_pesanan ->> 'wa_tampil',
    coalesce(p_pesanan -> 'warna','{}'::jsonb),
    p_pesanan ->> 'bank_nama', p_pesanan ->> 'bank_nomor', p_pesanan ->> 'bank_atas_nama',
    p_pesanan ->> 'logo_data_url', p_pesanan ->> 'bg_data_url', 'draft'
  returning id into v_order;

  for v_paket in select * from jsonb_array_elements(coalesce(p_paket,'[]'::jsonb))
  loop
    insert into public.license_packages (order_id, posisi, nama, harga, meta_atas, meta_bawah, warna, rank)
    values (v_order, v_posisi, v_paket ->> 'nama', v_paket ->> 'harga',
            coalesce(v_paket ->> 'meta_atas',''), coalesce(v_paket ->> 'meta_bawah',''),
            coalesce(v_paket ->> 'warna','#3ea6ff'), v_paket ->> 'rank');
    v_posisi := v_posisi + 1;
  end loop;

  if v_biaya > 0 then
    insert into public.coin_transactions (user_id, jumlah, jenis, keterangan, order_id)
    values (v_user, -v_biaya, 'pemakaian',
            'Pesanan ' || coalesce(p_pesanan ->> 'nama_usaha','-'), v_order);
  end if;

  return v_order;
end;
$fn$;

-- Postgres memberi EXECUTE ke public secara bawaan pada fungsi baru, dan
-- Supabase memetakan itu ke anon.
revoke execute on function public.buat_pesanan_berbayar(jsonb, jsonb) from anon, public;
revoke execute on function public.buat_topup(text, uuid) from anon, public;
revoke execute on function public.set_pembayaran_topup(text, text, text) from anon, public;
revoke execute on function public.batalkan_topup_sendiri(text) from anon, public;
revoke execute on function public.sesuaikan_koin(uuid, integer, text, text) from anon, public;
revoke execute on function public.saldo_koin(uuid) from anon, public;

grant execute on function public.biaya_pesanan() to authenticated;
grant execute on function public.buat_pesanan_berbayar(jsonb, jsonb) to authenticated;
grant execute on function public.buat_topup(text, uuid) to authenticated;
grant execute on function public.set_pembayaran_topup(text, text, text) to authenticated;
grant execute on function public.batalkan_topup_sendiri(text) to authenticated;
grant execute on function public.sesuaikan_koin(uuid, integer, text, text) to authenticated;
grant execute on function public.saldo_koin(uuid) to authenticated;

notify pgrst, 'reload schema';
