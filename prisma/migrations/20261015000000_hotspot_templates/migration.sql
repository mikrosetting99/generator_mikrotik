-- CreateTable
CREATE TABLE `hotspot_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL DEFAULT '',
    `design` VARCHAR(191) NOT NULL DEFAULT 'minimal',
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#38bdf8',
    `bgColor` VARCHAR(191) NOT NULL DEFAULT '#eef2f7',
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;