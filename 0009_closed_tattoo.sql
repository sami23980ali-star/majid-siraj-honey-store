ALTER TABLE `adminCredentials` MODIFY COLUMN `lockedUntil` datetime;--> statement-breakpoint
ALTER TABLE `adminSessions` MODIFY COLUMN `expiresAt` datetime NOT NULL;