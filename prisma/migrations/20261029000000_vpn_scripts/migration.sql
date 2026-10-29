-- CreateTable
CREATE TABLE `vpn_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vpn_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `vpn_scripts` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(40) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `customer` VARCHAR(120) NOT NULL DEFAULT '',
    `categoryId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `username` VARCHAR(160) NOT NULL DEFAULT '',
    `passwordEnc` TEXT NOT NULL,
    `scriptEnc` LONGTEXT NOT NULL,
    `note` VARCHAR(500) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vpn_scripts_token_key`(`token`),
    INDEX `vpn_scripts_phone_idx`(`phone`),
    INDEX `vpn_scripts_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `vpn_scripts` ADD CONSTRAINT `vpn_scripts_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `vpn_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;