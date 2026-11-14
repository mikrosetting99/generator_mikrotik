import type { RuleId } from "@/lib/nm/types";

/** Langkah pengecekan yang ditampilkan di setiap temuan Analisa. */
export const CHECK_STEPS: Record<RuleId, string[]> = {
  cpu_high: [
    "Buka WinBox → Tools → Profile, pilih CPU all, lalu lihat proses yang paling tinggi (mis. firewall, dns, management, queue).",
    "Firewall: periksa IP → Firewall → Connections. Lonjakan koneksi atau rule tanpa connection-state bisa membebani CPU.",
    "DNS: bila proses dns tinggi, cek IP → DNS (allow-remote-requests) dan blokir akses DNS dari luar di chain input.",
    "Queue: simple queue yang sangat banyak memakan CPU; pertimbangkan queue tree/PCQ.",
    "Terminal: /system resource cpu print untuk melihat beban per core.",
  ],
  wan_down: [
    "WinBox → Interfaces: lihat status interface WAN (R = running) dan kolom Link Downs.",
    "Periksa kabel, modem/ONT ISP, dan lampu link di port fisik.",
    "Terminal: /interface ethernet monitor <nama-wan> once untuk melihat status, rate, dan auto-negotiation.",
    "Bila interface PPPoE client: cek /interface pppoe-client monitor <nama> dan log PPP di System → Log.",
    "Hubungi ISP bila link fisik up tetapi koneksi WAN tetap tidak naik.",
  ],
  ppp_drop: [
    "WinBox → PPP → Active Connections: pastikan sesi yang hilang dan uptime sesi yang tersisa.",
    "System → Log (topik pppoe, radius): cari alasan putus massal seperti RADIUS timeout atau authentication failed.",
    "Bila memakai RADIUS: cek /radius monitor dan apakah server RADIUS terjangkau.",
    "Periksa interface sisi pelanggan (bridge/VLAN/OLT) apakah ada link down bersamaan.",
    "Periksa CPU dan memori router pada waktu yang sama (tab Ringkasan).",
  ],
  unreachable: [
    "Pastikan router menyala dan jalur ke router (internet/VPN site) tidak putus.",
    "Ping alamat router dari jaringan lain untuk memastikan masalahnya bukan di sisi collector.",
    "Bila lewat VPN: cek status tunnel di server VPN dan di router.",
    "Status WAN dan metrik lain belum dapat diverifikasi sampai router terjangkau lagi.",
  ],
  api_error: [
    "Router masih terjangkau, tetapi RouterOS API gagal. Periksa IP → Services: service api/api-ssl aktif dan port benar.",
    "Pastikan kolom Available From di service itu mengizinkan IP collector.",
    "Periksa user monitoring: grup harus punya policy read dan api, dan password belum diganti.",
    "Untuk API-SSL: sertifikat harus valid, atau isi fingerprint SHA-256 sertifikat di Pengaturan perangkat.",
  ],
};
