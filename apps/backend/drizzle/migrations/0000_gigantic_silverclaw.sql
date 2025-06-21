CREATE TABLE `activated_models` (
	`model_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`capabilities` text NOT NULL,
	`model_type` text DEFAULT 'unknown',
	`group_name` text,
	`icon` text,
	`default_channel_id` text,
	`tags` text,
	`tokenizer_id` text,
	`created_at` text DEFAULT '2025-06-21T08:28:06.845Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`provider_id` text,
	`adapter_type` text,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`storage_mode` text DEFAULT 'plaintext' NOT NULL,
	`custom_headers` text,
	`model_list_endpoint` text,
	`supported_models` text,
	`disabled` integer DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `external_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`service_name` text NOT NULL,
	`display_name` text,
	`display_hint` text,
	`encrypted_credential` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `service_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text,
	`prefix` text NOT NULL,
	`hashed_key` text NOT NULL,
	`scopes` text,
	`created_at` text NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_api_keys_hashed_key_unique` ON `service_api_keys` (`hashed_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`uid` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text,
	`avatar_url` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);