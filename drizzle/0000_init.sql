CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_email` text NOT NULL,
	`buyer_country` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`promo_id` text,
	`promo_code` text,
	`discount` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`slot_start` integer,
	`access_token` text NOT NULL,
	`provider_session_id` text,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`cancelled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_access_token_unique` ON `orders` (`access_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_provider_session_id_unique` ON `orders` (`provider_session_id`);--> statement-breakpoint
CREATE INDEX `orders_store_idx` ON `orders` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_product_idx` ON `orders` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_items` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`store_id` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`video_url` text,
	`file_key` text,
	`file_name` text,
	`file_size` integer,
	`content_type` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_product_idx` ON `product_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`country_prices` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`duration_minutes` integer,
	`buffer_minutes` integer,
	`location` text DEFAULT '' NOT NULL,
	`availability` text DEFAULT '[]' NOT NULL,
	`sessions` text DEFAULT '[]' NOT NULL,
	`capacity` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_store_idx` ON `products` (`store_id`);--> statement-breakpoint
CREATE TABLE `promos` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`product_id` text,
	`expires_on` text,
	`max_redemptions` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promos_store_code` ON `promos` (`store_id`,`code`);--> statement-breakpoint
CREATE TABLE `slot_holds` (
	`store_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`order_id` text NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slot_holds_store_start` ON `slot_holds` (`store_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_user_id_unique` ON `stores` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stores_slug_unique` ON `stores` (`slug`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visits_store_idx` ON `visits` (`store_id`,`created_at`);