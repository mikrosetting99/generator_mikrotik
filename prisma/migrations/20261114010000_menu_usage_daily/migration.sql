-- CreateTable
CREATE TABLE `menu_usage_daily` (
    `menuId` VARCHAR(64) NOT NULL,
    `day` CHAR(10) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    INDEX `menu_usage_daily_day_idx`(`day`),
    PRIMARY KEY (`menuId`, `day`)
) DEFAULT CHARACTER SET utf8mb4;
