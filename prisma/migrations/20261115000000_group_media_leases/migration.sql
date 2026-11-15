-- Additive only: preserves every existing call, participant, message, and user.
-- Apply in staging first; schedule the production migration only after approval.
ALTER TABLE `CallSession`
  ADD COLUMN `mediaVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `screenVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `screenLeaseId` VARCHAR(36) NULL,
  ADD COLUMN `screenRoomName` VARCHAR(191) NULL,
  ADD COLUMN `screenUserId` VARCHAR(191) NULL,
  ADD COLUMN `screenDeviceId` VARCHAR(128) NULL,
  ADD COLUMN `screenExpiresAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `CallSession_screenLeaseId_key` (`screenLeaseId`),
  ADD UNIQUE INDEX `CallSession_screenRoomName_key` (`screenRoomName`);

CREATE TABLE `RetiredMediaRoom` (
  `roomName` VARCHAR(191) NOT NULL,
  `callId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `retainUntil` DATETIME(3) NOT NULL,
  `retryAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lastErrorCode` VARCHAR(32) NULL,
  PRIMARY KEY (`roomName`),
  INDEX `RetiredMediaRoom_retryAt_idx` (`retryAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
