-- DropForeignKey
ALTER TABLE `Conversation` DROP FOREIGN KEY `Conversation_user1Id_fkey`;

-- DropForeignKey
ALTER TABLE `Conversation` DROP FOREIGN KEY `Conversation_user2Id_fkey`;

-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_receiverId_fkey`;

-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `kind` VARCHAR(16) NOT NULL DEFAULT 'DIRECT',
    ADD COLUMN `name` VARCHAR(100) NULL,
    ADD COLUMN `ownerId` VARCHAR(191) NULL,
    MODIFY `user1Id` VARCHAR(191) NULL,
    MODIFY `user2Id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Message` ADD COLUMN `clientMessageId` VARCHAR(64) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `durationMs` INTEGER NULL,
    ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `mediaAssetId` VARCHAR(191) NULL,
    ADD COLUMN `replyToId` INTEGER NULL,
    ADD COLUMN `waveform` JSON NULL,
    MODIFY `text` TEXT NULL,
    MODIFY `receiverId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ConversationMember` (
    `conversationId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastReadMessageId` INTEGER NULL,

    INDEX `ConversationMember_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`conversationId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageReaction` (
    `messageId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `emoji` VARCHAR(16) NOT NULL,

    INDEX `MessageReaction_userId_idx`(`userId`),
    PRIMARY KEY (`messageId`, `userId`, `emoji`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `conversationId` INTEGER NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `format` VARCHAR(16) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `waveform` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaAsset_publicId_key`(`publicId`),
    INDEX `MediaAsset_expiresAt_idx`(`expiresAt`),
    INDEX `MediaAsset_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallSession` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` INTEGER NOT NULL,
    `initiatorId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(8) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'RINGING',
    `roomName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CallSession_roomName_key`(`roomName`),
    INDEX `CallSession_conversationId_status_idx`(`conversationId`, `status`),
    INDEX `CallSession_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallParticipant` (
    `deviceId` VARCHAR(64) NULL,
    `callId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'INVITED',
    `joinedAt` DATETIME(3) NULL,
    `leftAt` DATETIME(3) NULL,

    INDEX `CallParticipant_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`callId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WatchParty` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` INTEGER NOT NULL,
    `hostId` VARCHAR(191) NOT NULL,
    `sourceUrl` TEXT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `collaborative` BOOLEAN NOT NULL DEFAULT false,
    `playing` BOOLEAN NOT NULL DEFAULT false,
    `position` DOUBLE NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `WatchParty_conversationId_endedAt_idx`(`conversationId`, `endedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Conversation_updatedAt_idx` ON `Conversation`(`updatedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Message_mediaAssetId_key` ON `Message`(`mediaAssetId`);

-- CreateIndex
CREATE INDEX `Message_conversationId_id_idx` ON `Message`(`conversationId`, `id`);

-- CreateIndex
CREATE INDEX `Message_receiverId_isRead_idx` ON `Message`(`receiverId`, `isRead`);

-- CreateIndex
CREATE UNIQUE INDEX `Message_senderId_clientMessageId_key` ON `Message`(`senderId`, `clientMessageId`);

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_user1Id_fkey` FOREIGN KEY (`user1Id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_user2Id_fkey` FOREIGN KEY (`user2Id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_replyToId_fkey` FOREIGN KEY (`replyToId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_mediaAssetId_fkey` FOREIGN KEY (`mediaAssetId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationMember` ADD CONSTRAINT `ConversationMember_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationMember` ADD CONSTRAINT `ConversationMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageReaction` ADD CONSTRAINT `MessageReaction_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageReaction` ADD CONSTRAINT `MessageReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallSession` ADD CONSTRAINT `CallSession_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallParticipant` ADD CONSTRAINT `CallParticipant_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `CallSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallParticipant` ADD CONSTRAINT `CallParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WatchParty` ADD CONSTRAINT `WatchParty_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
