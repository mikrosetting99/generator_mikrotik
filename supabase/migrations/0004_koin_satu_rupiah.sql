-- 1 koin = 1 rupiah.
--
-- Dengan rasio ini paket topup tidak lagi punya "kurs" sendiri -- isinya
-- sekadar nominal isi ulang. Nilai koin dan rupiah sengaja tetap disimpan
-- sebagai dua kolom, bukan disatukan: kalau suatu saat ada bonus ("bayar
-- 100.000 dapat 110.000 koin"), yang berubah cukup datanya, bukan skemanya.

delete from public.coin_packages;

insert into public.coin_packages (nama, koin, rupiah, urutan) values
  ('Rp 25.000',  25000,  25000, 1),
  ('Rp 50.000',  50000,  50000, 2),
  ('Rp 100.000', 100000, 100000, 3),
  ('Rp 250.000', 250000, 250000, 4);

-- Biaya lama 25 koin kini berarti Rp 25. Angka di bawah ini SEMENTARA --
-- ubah sesuai harga jual Anda:
--   update public.pengaturan set nilai = '<harga>' where kunci = 'biaya_pesanan';
update public.pengaturan set nilai = '25000' where kunci = 'biaya_pesanan';
