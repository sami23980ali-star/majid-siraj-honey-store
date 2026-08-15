ALTER TABLE `products` ADD `inventoryCount` int DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `lowStockThreshold` int DEFAULT 5 NOT NULL;