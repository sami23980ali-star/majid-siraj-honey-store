ALTER TABLE `adminCredentials` MODIFY COLUMN `phone` varchar(48);--> statement-breakpoint
ALTER TABLE `adminCredentials` ADD `displayName` varchar(120) DEFAULT 'مستخدم الإدارة' NOT NULL;--> statement-breakpoint
ALTER TABLE `adminCredentials` ADD `adminCredentialRole` enum('owner','manager','editor') DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE `adminCredentials` ADD `isActive` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `adminCredentials` ADD `createdByCredentialId` int;--> statement-breakpoint
ALTER TABLE `adminCredentials` MODIFY `phone` varchar(48) NULL;
