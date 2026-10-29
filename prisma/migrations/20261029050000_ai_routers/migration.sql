-- CreateTable
CREATE TABLE `ai_routers` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `host` VARCHAR(253) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 8728,
    `tls` BOOLEAN NOT NULL DEFAULT false,
    `username` VARCHAR(100) NOT NULL,
    `passwordEnc` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_routers_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `ai_routers` ADD CONSTRAINT `ai_routers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;