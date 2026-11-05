-- CreateTable
CREATE TABLE `vpn_servers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `location` VARCHAR(80) NOT NULL DEFAULT '',
    `domain` VARCHAR(160) NOT NULL,
    `publicIp` VARCHAR(15) NOT NULL,
    `subnet` VARCHAR(18) NOT NULL,
    `gatewayIp` VARCHAR(15) NOT NULL,
    `protocols` VARCHAR(20) NOT NULL DEFAULT 'sstp,l2tp,ovpn',
    `rosVersion` VARCHAR(4) NOT NULL DEFAULT 'v6',
    `capacity` INTEGER NOT NULL DEFAULT 250,
    `radiusSecret` VARCHAR(64) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vpn_servers_domain_key`(`domain`),
    UNIQUE INDEX `vpn_servers_publicIp_key`(`publicIp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `vpn_packages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `priceIdr` INTEGER NOT NULL DEFAULT 0,
    `durationDays` INTEGER NOT NULL DEFAULT 30,
    `uploadKbps` INTEGER NOT NULL DEFAULT 0,
    `downloadKbps` INTEGER NOT NULL DEFAULT 0,
    `portForwards` INTEGER NOT NULL DEFAULT 0,
    `maxAccounts` INTEGER NOT NULL DEFAULT 1,
    `protocols` VARCHAR(20) NOT NULL DEFAULT 'sstp,l2tp,ovpn',
    `serverIds` VARCHAR(1000) NOT NULL DEFAULT '',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `vpn_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(41) NOT NULL,
    `passwordEnc` TEXT NOT NULL,
    `ntHash` CHAR(32) NOT NULL,
    `tunnelIp` VARCHAR(15) NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
    `expiresAt` DATETIME(3) NULL,
    `note` VARCHAR(300) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vpn_accounts_username_key`(`username`),
    INDEX `vpn_accounts_userId_idx`(`userId`),
    INDEX `vpn_accounts_packageId_idx`(`packageId`),
    UNIQUE INDEX `vpn_accounts_serverId_tunnelIp_key`(`serverId`, `tunnelIp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `radacct` (
    `radacctid` BIGINT NOT NULL AUTO_INCREMENT,
    `acctsessionid` VARCHAR(64) NOT NULL DEFAULT '',
    `acctuniqueid` VARCHAR(32) NOT NULL DEFAULT '',
    `username` VARCHAR(64) NOT NULL DEFAULT '',
    `nasipaddress` VARCHAR(15) NOT NULL DEFAULT '',
    `nasportid` VARCHAR(32) NULL,
    `acctstarttime` DATETIME(0) NULL,
    `acctupdatetime` DATETIME(0) NULL,
    `acctstoptime` DATETIME(0) NULL,
    `acctsessiontime` INTEGER UNSIGNED NULL,
    `acctinputoctets` BIGINT NULL,
    `acctoutputoctets` BIGINT NULL,
    `callingstationid` VARCHAR(50) NOT NULL DEFAULT '',
    `acctterminatecause` VARCHAR(32) NOT NULL DEFAULT '',
    `framedipaddress` VARCHAR(15) NOT NULL DEFAULT '',

    UNIQUE INDEX `radacct_acctuniqueid_key`(`acctuniqueid`),
    INDEX `radacct_username_idx`(`username`),
    INDEX `radacct_acctstoptime_idx`(`acctstoptime`),
    INDEX `radacct_nasipaddress_idx`(`nasipaddress`),
    INDEX `radacct_framedipaddress_idx`(`framedipaddress`),
    INDEX `radacct_acctsessionid_idx`(`acctsessionid`),
    PRIMARY KEY (`radacctid`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `vpn_accounts` ADD CONSTRAINT `vpn_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vpn_accounts` ADD CONSTRAINT `vpn_accounts_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `vpn_servers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vpn_accounts` ADD CONSTRAINT `vpn_accounts_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `vpn_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- View untuk FreeRADIUS (deploy/radius). FreeRADIUS hanya diberi izin SELECT pada view ini dan
-- SELECT/INSERT/UPDATE pada radacct, tidak pada tabel aplikasi.

-- Akun yang boleh login: aktif, belum lewat masa aktif, dan servernya aktif.
CREATE OR REPLACE VIEW `radius_active` AS
SELECT a.`id`, a.`username`, a.`ntHash`, a.`tunnelIp`, a.`serverId`, p.`uploadKbps`, p.`downloadKbps`
FROM `vpn_accounts` a
JOIN `vpn_servers` s ON s.`id` = a.`serverId`
JOIN `vpn_packages` p ON p.`id` = a.`packageId`
WHERE a.`status` = 'active'
  AND (a.`expiresAt` IS NULL OR a.`expiresAt` > UTC_TIMESTAMP(3))
  AND s.`active` = 1;

-- Daftar NAS: satu baris per CHR. shortname = id server, dipakai queries.conf untuk mengikat akun ke servernya.
CREATE OR REPLACE VIEW `radius_nas` AS
SELECT `id`, `publicIp` AS `nasname`, `id` AS `shortname`, 'other' AS `type`, `radiusSecret` AS `secret`, CAST(NULL AS CHAR(64)) AS `server`
FROM `vpn_servers`;

CREATE OR REPLACE VIEW `radius_check` AS
SELECT `id`, `username`, 'NT-Password' AS `attribute`, ':=' AS `op`, `ntHash` AS `value`, `serverId` AS `server_id` FROM `radius_active`
UNION ALL
SELECT `id`, `username`, 'Simultaneous-Use', ':=', '1', `serverId` FROM `radius_active`;

-- Mikrotik-Rate-Limit = upload/download pelanggan (rx/tx dari sisi CHR); sama dengan rateLimitValue() di lib/vpn-radius.ts.
CREATE OR REPLACE VIEW `radius_reply` AS
SELECT `id`, `username`, 'Framed-IP-Address' AS `attribute`, '=' AS `op`, `tunnelIp` AS `value`, `serverId` AS `server_id` FROM `radius_active`
UNION ALL
SELECT `id`, `username`, 'Mikrotik-Rate-Limit', '=',
  CONCAT(
    CASE WHEN `uploadKbps` = 0 THEN '0' WHEN `uploadKbps` % 1024 = 0 THEN CONCAT(`uploadKbps` DIV 1024, 'M') ELSE CONCAT(`uploadKbps`, 'k') END,
    '/',
    CASE WHEN `downloadKbps` = 0 THEN '0' WHEN `downloadKbps` % 1024 = 0 THEN CONCAT(`downloadKbps` DIV 1024, 'M') ELSE CONCAT(`downloadKbps`, 'k') END
  ),
  `serverId`
FROM `radius_active`
WHERE `uploadKbps` > 0 OR `downloadKbps` > 0;
