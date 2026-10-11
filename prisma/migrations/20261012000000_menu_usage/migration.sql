-- CreateTable
CREATE TABLE `menu_usage` (
    `menuId` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`menuId`)
) DEFAULT CHARACTER SET utf8mb4;
