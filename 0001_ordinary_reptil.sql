CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`phone` varchar(48) NOT NULL,
	`city` varchar(120),
	`address` text,
	`notes` text,
	`itemsJson` text NOT NULL,
	`total` int NOT NULL,
	`currency` varchar(20) NOT NULL DEFAULT 'ر.ي',
	`status` enum('new','preparing','completed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`shortDescription` text NOT NULL,
	`description` text NOT NULL,
	`origin` varchar(120) NOT NULL DEFAULT 'عسل بلدي',
	`category` varchar(120) NOT NULL DEFAULT 'عسل بلدي',
	`priceOptions` text NOT NULL,
	`primaryImage` text NOT NULL,
	`galleryImages` text NOT NULL,
	`isFeatured` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `storeSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`whatsappNumber` varchar(32) NOT NULL,
	`supportPhone` varchar(32) NOT NULL,
	`secondaryPhone` varchar(32),
	`locationText` varchar(180) NOT NULL DEFAULT 'اليمن',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storeSettings_id` PRIMARY KEY(`id`)
);
