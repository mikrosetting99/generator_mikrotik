import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createZip, type ZipEntry } from "@/lib/zip";
import { cetakLoginHtml, type Pesanan } from "./build";
import { periksaLoginHtml, pastikanLolos } from "./validate";
import { cariTemplate } from "./templates";

const AKAR_TEMPLATE = path.join(process.cwd(), "templates");

/** Berkas yang tidak pernah ikut diserahkan ke pembeli. */
const JANGAN_IKUT = new Set(["preview.html", "desktop.ini", ".gitkeep"]);

/**
 * Menyiapkan PANDUAN-EDIT.txt untuk mata pembeli.
 *
 * Dua hal harus diurus. Pertama, panduan itu ditulis untuk template dan masih
 * menyebut nomor serta merek bawaannya — pembeli yang membaca "Find:
 * 6281112001036" tidak akan menemukan apa pun di berkasnya.
 *
 * Kedua, dan ini yang lebih penting: ada satu bagian bertanda "khusus
 * MIKROSETTING, jangan dijelaskan ke pembeli" yang menjelaskan cara kerja
 * lisensi, alur penjualan, dan sejauh mana perlindungannya. Bagian itu
 * dipotong sebelum berkasnya masuk zip.
 */
function rapikanPanduan(teks: string, p: Pesanan, slug: string): string {
  const t = cariTemplate(slug);

  let keluar = teks
    .split(t.waAsli).join(p.waNomor)
    .split(t.nomorTampilAsli).join(p.waTampil)
    .split(t.merekAsli).join(p.namaUsaha);

  const GARIS = "=".repeat(79);
  const tanda = keluar.indexOf("LISENSI   (khusus");
  if (tanda > 0) {
    /* Mundur ke garis pembuka bagian itu, maju ke garis pembuka bagian
       berikutnya. Nomor bagiannya berbeda tiap template, jadi dicari lewat
       garisnya, bukan lewat angkanya. */
    const awal = keluar.lastIndexOf(GARIS, tanda);
    const sesudah = keluar.indexOf(GARIS, keluar.indexOf(GARIS, tanda) + GARIS.length);
    const berikut = keluar.indexOf(GARIS, sesudah + GARIS.length);
    if (awal >= 0 && berikut > awal) {
      keluar = keluar.slice(0, awal) + keluar.slice(berikut);
    }
  }

  /* Sisa rujukan yang tersebar di luar bagian itu. Yang penting bukan
     merahasiakan bahwa halaman ini berlisensi — layar penolakannya sudah
     mengatakan itu — melainkan tidak menunjukkan DI MANA kunci dibuat dan
     APA yang membuatnya cocok. */
  return keluar
    .split("\n")
    .filter((baris) => !/generator-lisensi|LIS_SALT/i.test(baris))
    .join("\n");
}

/**
 * Semua berkas template selain login.html.
 *
 * `img/bg.jpg` bawaan tema ikut, karena latar itu bagian dari desain temanya —
 * pembeli yang tidak mengunggah latar sendiri tetap mendapat tampilan yang
 * sama dengan contoh yang dilihatnya. Kalau pesanan punya latar sendiri,
 * berkas bawaan dilewati supaya tidak ada dua entri bernama sama di dalam zip.
 *
 * `img/logo.png` TIDAK PERNAH ikut. Logo di folder template adalah logo
 * MIKROSETTING; menyertakannya berarti memasang logo penjual di halaman milik
 * pembeli. Dijaga di sini, bukan hanya dengan tidak menaruh berkasnya, supaya
 * tetap aman kalau suatu saat ada yang menyalin folder template lengkap.
 */
async function berkasPendukung(
  slug: string,
  lewati: { logo: boolean; latar: boolean }
): Promise<ZipEntry[]> {
  const akar = path.join(AKAR_TEMPLATE, slug);
  const keluar: ZipEntry[] = [];

  async function telusuri(rel: string) {
    for (const entri of await readdir(path.join(akar, rel), { withFileTypes: true })) {
      const anak = rel ? `${rel}/${entri.name}` : entri.name;
      if (JANGAN_IKUT.has(entri.name)) continue;
      if (entri.isDirectory()) {
        await telusuri(anak);
        continue;
      }
      if (anak === "login.html") continue;
      if (anak === "img/logo.png") continue;
      if (anak === "img/bg.jpg" && lewati.latar) continue;

      const isi = await readFile(path.join(akar, anak));
      /* Berkas biner (favicon, font) lewat data URI, karena ZipEntry hanya
         menerima teks atau data URI — bukan Buffer. */
      keluar.push(
        /\.(ico|woff2?|ttf|eot|png|jpg|jpeg|gif)$/i.test(anak)
          ? { name: anak, dataUrl: `data:application/octet-stream;base64,${isi.toString("base64")}` }
          : { name: anak, content: isi.toString("utf8") }
      );
    }
  }

  await stat(akar);
  await telusuri("");
  return keluar;
}

function catatanPesanan(p: Pesanan, nomor: number | null, kunci: string): string {
  /* null = baris yang memang tidak dipakai, dibuang di akhir.
     String kosong = baris kosong yang disengaja, harus bertahan. */
  const baris: (string | null)[] = [
    "INFORMASI PESANAN",
    "=================",
    "",
    nomor ? `Nomor pesanan : #${nomor}` : null,
    `Nama usaha    : ${p.namaUsaha}`,
    `Template      : ${cariTemplate(p.templateSlug).nama} (${p.templateSlug})`,
    `WhatsApp      : ${p.waTampil}  (${p.waNomor})`,
    `Dicetak       : ${new Date().toLocaleString("id-ID")}`,
    "",
  ];

  if (kunci) {
    baris.push(
      "LISENSI SUDAH AKTIF",
      "-------------------",
      `ID ROUTER   : ${p.routerIdentity}`,
      `KUNCI       : ${kunci}`,
      "",
      "Kunci ini hanya berlaku untuk router dengan System > Identity",
      "yang tertulis di atas. Kalau nama routernya diganti, halaman akan",
      "terkunci lagi dan perlu kunci baru.",
      ""
    );
  } else {
    baris.push(
      "LISENSI BELUM DIISI",
      "-------------------",
      "Upload dulu isi folder ini ke router, lalu buka halaman login.",
      "Akan muncul layar LISENSI TIDAK AKTIF berisi ID ROUTER.",
      "Kirim ID ROUTER itu lewat tombol WhatsApp yang tersedia di layar",
      "tersebut, nanti dikirimkan kunci lisensinya.",
      ""
    );
  }

  baris.push(
    "CARA UPLOAD KE MIKROTIK",
    "-----------------------",
    "1. Winbox > Files > buat folder baru, misalnya  hotspot1",
    "2. Blok semua berkas di folder ini, drag ke folder tadi",
    "3. IP > Hotspot > Server Profiles > profile Anda",
    "4. HTML Directory diisi nama folder tadi, lalu Apply > OK",
    "",
    "Supaya tombol WhatsApp bisa diklik sebelum login, buka",
    "IP > Hotspot > Walled Garden untuk wa.me dan api.whatsapp.com.",
    "",
    "Penjelasan lengkap ada di PANDUAN-EDIT.txt.",
    ""
  );

  return baris.filter((b): b is string => b !== null).join("\n") + "\n";
}

export type HasilZip = { isi: Buffer; namaBerkas: string; kunci: string };

/**
 * Mencetak satu folder siap upload.
 *
 * Berkasnya diperiksa dulu; kalau ada temuan berat, zip tidak jadi dibuat.
 * Menyerahkan berkas rusak jauh lebih mahal daripada gagal mencetak — begitu
 * berkasnya ada di router pelanggan, perbaikannya lewat telepon.
 *
 * Memakai penulis zip milik proyek ini (metode "store", tanpa kompresi) agar
 * tidak ada dua implementasi zip dalam satu basis kode. Konsekuensinya berkas
 * hasilnya beberapa ratus KB, bukan puluhan — masih wajar untuk diunduh dan
 * tidak memengaruhi ukuran yang tersimpan di router, karena router menyimpan
 * isinya, bukan zip-nya.
 */
export async function cetakZip(p: Pesanan, nomor: number | null): Promise<HasilZip> {
  const html = await cetakLoginHtml(p);

  const temuan = periksaLoginHtml(html, {
    jumlahKartu: p.paket.length,
    waPembeli: p.waNomor,
    waPenerbit: process.env.MSLP_LICENSOR_WA || "6281112001036",
  });
  pastikanLolos(temuan);

  const kunci = html.match(/var LIS_KEY {2}= "([^"]*)";/)?.[1] ?? "";

  const entries: ZipEntry[] = [{ name: "login.html", content: html }];

  const pendukung = await berkasPendukung(p.templateSlug, {
    logo: Boolean(p.logoDataUrl),
    latar: Boolean(p.bgDataUrl),
  });

  for (const b of pendukung) {
    if (b.name === "PANDUAN-EDIT.txt" && b.content) {
      entries.push({ name: b.name, content: rapikanPanduan(b.content, p, p.templateSlug) });
    } else {
      entries.push(b);
    }
  }

  /* Logo dan latar ikut sebagai berkas di dalam zip, bukan sebagai tautan.
     Router menyajikannya sendiri dan pelanggan belum punya internet saat
     halaman login terbuka. */
  if (p.logoDataUrl) entries.push({ name: "img/logo.png", dataUrl: p.logoDataUrl });
  if (p.bgDataUrl) entries.push({ name: "img/bg.jpg", dataUrl: p.bgDataUrl });

  entries.push({ name: "INFORMASI-PESANAN.txt", content: catatanPesanan(p, nomor, kunci) });

  const blob = createZip(entries);

  return {
    isi: Buffer.from(await blob.arrayBuffer()),
    namaBerkas: `${p.namaUsaha.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${p.templateSlug}.zip`,
    kunci,
  };
}
