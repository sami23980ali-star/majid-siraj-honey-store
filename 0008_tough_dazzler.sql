ALTER TABLE `orders` MODIFY COLUMN `status` enum('awaiting_payment','new','preparing','completed','cancelled') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `orders` ADD `orderChannel` enum('whatsapp','online') DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `stockDeducted` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `checkoutReference` varchar(255);--> statement-breakpoint
-- Backfill: every order that existed before this migration came from the
-- WhatsApp flow, which deducts stock at creation time. Without this the
-- cancel path would refuse to return their stock, because `stockDeducted`
-- would default to 0 and the order would look like it never held any.
UPDATE `orders` SET `stockDeducted` = 1 WHERE `status` <> 'cancelled';