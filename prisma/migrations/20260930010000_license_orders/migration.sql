-- CreateTable
CREATE TABLE `license_orders` (
    `id` VARCHAR(191) NOT NULL,
    `nomor` INTEGER NOT NULL AUTO_INCREMENT,
    `namaUsaha` VARCHAR(191) NOT NULL,
    `kontakNama` VARCHAR(191) NULL,
    `catatan` VARCHAR(191) NULL,
    `templateSlug` VARCHAR(191) NOT NULL,
    `merekA` VARCHAR(191) NOT NULL,
    `merekB` VARCHAR(191) NOT NULL DEFAULT '',
    `merekSpasi` BOOLEAN NOT NULL DEFAULT true,
    `tagline` VARCHAR(191) NOT NULL DEFAULT 'INTERNET HOTSPOT VOUCHER',
    `footerTagline` VARCHAR(191) NOT NULL DEFAULT 'Internet Hotspot Voucher',
    `waNomor` VARCHAR(191) NOT NULL,
    `waTampil` VARCHAR(191) NOT NULL,
    `warna` JSON NULL,
    `bankNama` VARCHAR(191) NULL,
    `bankNomor` VARCHAR(191) NULL,
    `bankAtasNama` VARCHAR(191) NULL,
    `logoDataUrl` LONGTEXT NULL,
    `bgDataUrl` LONGTEXT NULL,
    `routerIdentity` VARCHAR(191) NULL,
    `lisensiKunci` VARCHAR(191) NULL,
    `lisensiTerbitPada` DATETIME(3) NULL,
    `status` ENUM('draft', 'terkirim', 'aktif', 'batal') NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `license_orders_nomor_key`(`nomor`),
    INDEX `license_orders_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `license_packages` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `posisi` INTEGER NOT NULL DEFAULT 0,
    `nama` VARCHAR(191) NOT NULL,
    `harga` VARCHAR(191) NOT NULL,
    `metaAtas` VARCHAR(191) NOT NULL DEFAULT 'Masa aktif',
    `metaBawah` VARCHAR(191) NOT NULL DEFAULT '',
    `warna` VARCHAR(191) NOT NULL DEFAULT '#3ea6ff',
    `rank` VARCHAR(191) NULL,

    INDEX `license_packages_orderId_posisi_idx`(`orderId`, `posisi`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `license_packages` ADD CONSTRAINT `license_packages_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `license_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
