-- AlterTable
ALTER TABLE `ai_routers` ADD COLUMN `sshPort` INTEGER NOT NULL DEFAULT 0;

-- Router yang tadinya hanya SSH: port pindah ke sshPort, API dinonaktifkan.
UPDATE `ai_routers` SET `sshPort` = `port`, `port` = 0 WHERE `protocol` = 'ssh';
