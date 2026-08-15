CREATE TABLE `adminCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`phone` varchar(48) NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `adminCredentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `adminLoginAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminCredentialId` int,
	`username` varchar(64) NOT NULL,
	`success` int NOT NULL DEFAULT 0,
	`ipAddress` varchar(64),
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminLoginAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adminSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminCredentialId` int NOT NULL,
	`sessionTokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `adminSessions_sessionTokenHash_unique` UNIQUE(`sessionTokenHash`)
);
