CREATE TABLE IF NOT EXISTS `archive_songs` (
  `id` text PRIMARY KEY NOT NULL,
  `display_title` text NOT NULL,
  `base_title` text NOT NULL,
  `normalized_base_title` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `archive_songs_normalized_base_idx` ON `archive_songs` (`normalized_base_title`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_songs_display_title_idx` ON `archive_songs` (`display_title`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `archive_song_names` (
  `id` text PRIMARY KEY NOT NULL,
  `song_id` text NOT NULL,
  `alias_text` text NOT NULL,
  `normalized_alias` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`song_id`) REFERENCES `archive_songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `archive_song_names_song_alias_idx` ON `archive_song_names` (`song_id`,`normalized_alias`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_song_names_normalized_idx` ON `archive_song_names` (`normalized_alias`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `archive_video_songs` (
  `id` text PRIMARY KEY NOT NULL,
  `video_id` text NOT NULL,
  `song_id` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`video_id`) REFERENCES `archive_videos`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`song_id`) REFERENCES `archive_songs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `archive_video_songs_video_song_idx` ON `archive_video_songs` (`video_id`,`song_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_video_songs_song_idx` ON `archive_video_songs` (`song_id`,`video_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_video_songs_video_order_idx` ON `archive_video_songs` (`video_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `archive_song_conflicts` (
  `id` text PRIMARY KEY NOT NULL,
  `input_title` text NOT NULL,
  `normalized_value` text NOT NULL,
  `candidate_song_ids_json` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `resolved_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_song_conflicts_status_idx` ON `archive_song_conflicts` (`status`,`created_at`);
