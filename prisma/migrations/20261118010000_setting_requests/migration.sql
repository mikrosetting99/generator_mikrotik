-- CreateTable
CREATE TABLE `setting_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `label` VARCHAR(120) NOT NULL DEFAULT '',
    `status` VARCHAR(12) NOT NULL DEFAULT 'menunggu',
    `purpose` VARCHAR(16) NOT NULL DEFAULT '',
    `modelId` VARCHAR(40) NOT NULL DEFAULT '',
    `businessName` VARCHAR(80) NOT NULL DEFAULT '',
    `email` VARCHAR(120) NOT NULL DEFAULT '',
    `phone` VARCHAR(20) NOT NULL DEFAULT '',
    `templateId` VARCHAR(40) NOT NULL DEFAULT '',
    `needs` TEXT NULL,
    `routerPassword` VARCHAR(40) NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `setting_requests_token_key`(`token`),
    INDEX `setting_requests_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `setting_requests` ADD CONSTRAINT `setting_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
