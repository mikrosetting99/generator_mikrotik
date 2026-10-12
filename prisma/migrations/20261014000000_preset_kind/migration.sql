-- AlterTable
ALTER TABLE `background_presets` ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'background';

-- CreateIndex
CREATE INDEX `background_presets_kind_idx` ON `background_presets`(`kind`);
