CREATE TABLE `activated_models` (
	`model_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`capabilities` text NOT NULL,
	`model_type` text DEFAULT 'unknown',
	`group_name` text,
	`icon` text,
	`default_channel_ref` text,
	`tags` text,
	`tokenizer_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ref_name` text NOT NULL,
	`label` text,
	`provider_id` text,
	`adapter_type` text,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`storage_mode` text DEFAULT 'plaintext' NOT NULL,
	`custom_headers` text,
	`model_list_endpoint` text,
	`disabled` integer DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
