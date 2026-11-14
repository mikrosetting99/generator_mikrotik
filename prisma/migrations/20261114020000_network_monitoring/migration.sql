-- Network Monitoring (Tahap 1): perangkat, sampel, temuan Analisa, detak collector. Hanya tabel baru.
-- CreateTable
CREATE TABLE `nm_devices` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `site` VARCHAR(80) NOT NULL DEFAULT '',
    `kind` VARCHAR(12) NOT NULL DEFAULT 'router',
    `vendor` VARCHAR(20) NOT NULL DEFAULT 'mikrotik',
    `host` VARCHAR(253) NOT NULL DEFAULT '',
    `apiPort` INTEGER NOT NULL DEFAULT 8728,
    `tls` BOOLEAN NOT NULL DEFAULT false,
    `tlsFingerprint` VARCHAR(100) NOT NULL DEFAULT '',
    `username` VARCHAR(100) NOT NULL DEFAULT '',
    `passwordEnc` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `intervalSec` INTEGER NOT NULL DEFAULT 60,
    `wanInterfaces` VARCHAR(500) NOT NULL DEFAULT '',
    `rules` JSON NULL,
    `lastPollAt` DATETIME(3) NULL,
    `lastSampleAt` DATETIME(3) NULL,
    `state` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `nm_devices_userId_idx`(`userId`),
    INDEX `nm_devices_enabled_lastPollAt_idx`(`enabled`, `lastPollAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `nm_samples` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `deviceId` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `reachable` BOOLEAN NOT NULL,
    `apiOk` BOOLEAN NOT NULL,
    `cpu` INTEGER NULL,
    `memPct` DOUBLE NULL,
    `uptimeSec` INTEGER NULL,
    `ppp` INTEGER NULL,
    `hotspot` INTEGER NULL,
    `wan` JSON NULL,
    `error` VARCHAR(300) NOT NULL DEFAULT '',

    INDEX `nm_samples_deviceId_at_idx`(`deviceId`, `at`),
    INDEX `nm_samples_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `nm_findings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `rule` VARCHAR(24) NOT NULL,
    `subject` VARCHAR(80) NOT NULL DEFAULT '',
    `activeKey` VARCHAR(200) NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'active',
    `summary` VARCHAR(300) NOT NULL,
    `triggerValue` VARCHAR(200) NOT NULL,
    `evidence` JSON NOT NULL,
    `recovery` VARCHAR(300) NOT NULL DEFAULT '',
    `startedAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `nm_findings_activeKey_key`(`activeKey`),
    INDEX `nm_findings_userId_status_idx`(`userId`, `status`),
    INDEX `nm_findings_deviceId_startedAt_idx`(`deviceId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `nm_collectors` (
    `id` VARCHAR(64) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `lastBeatAt` DATETIME(3) NOT NULL,
    `info` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `nm_devices` ADD CONSTRAINT `nm_devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nm_samples` ADD CONSTRAINT `nm_samples_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `nm_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nm_findings` ADD CONSTRAINT `nm_findings_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `nm_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

