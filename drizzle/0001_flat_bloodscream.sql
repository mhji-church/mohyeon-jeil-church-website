CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`birth_date` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`force_password_change` integer DEFAULT false NOT NULL,
	`approved_at` text,
	`approved_by` text,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_username_unique` ON `members` (`username`);