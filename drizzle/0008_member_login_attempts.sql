CREATE TABLE IF NOT EXISTS `member_login_attempts` (
	`rate_key` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`blocked_until` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `member_login_attempts_updated_idx` ON `member_login_attempts` (`updated_at`);
