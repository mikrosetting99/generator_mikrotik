# FreeRADIUS untuk akun VPN pelanggan. 3.2.5 ke atas: sudah membawa perbaikan BlastRADIUS (CVE-2024-3596).
FROM freeradius/freeradius-server:3.2.5

# EAP dan inner-tunnel tidak dipakai (hanya PPP dari CHR) dan butuh sertifikat bila dibiarkan aktif.
RUN rm -f /etc/freeradius/mods-enabled/eap /etc/freeradius/sites-enabled/inner-tunnel

COPY sql /etc/freeradius/mods-enabled/sql
COPY queries.conf /etc/freeradius/mods-config/sql/main/mysql/queries.conf
COPY default /etc/freeradius/sites-enabled/default
COPY clients.conf /etc/freeradius/clients.conf
