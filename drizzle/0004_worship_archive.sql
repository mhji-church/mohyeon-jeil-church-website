CREATE TABLE IF NOT EXISTS `archive_videos` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL CHECK (`type` IN ('worship', 'attendance')),
  `date` text NOT NULL,
  `service_type` text NOT NULL,
  `title` text NOT NULL,
  `preacher` text NOT NULL DEFAULT '',
  `youtube_id` text NOT NULL UNIQUE,
  `youtube_url` text NOT NULL,
  `thumbnail_url` text NOT NULL DEFAULT '',
  `duration_seconds` integer,
  `note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_videos_date_idx` ON `archive_videos` (`date` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_videos_type_service_idx` ON `archive_videos` (`type`, `service_type`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member_app_access` (
  `member_id` text NOT NULL,
  `app_code` text NOT NULL,
  `access_level` text NOT NULL DEFAULT 'none' CHECK (`access_level` IN ('none', 'worship', 'full')),
  `granted_by` text,
  `granted_at` text,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`member_id`, `app_code`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `member_app_access_level_idx` ON `member_app_access` (`app_code`, `access_level`);
