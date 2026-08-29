CREATE TABLE IF NOT EXISTS `archive_video_analyses` (
  `video_id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'not_started' NOT NULL,
  `analysis_version` text DEFAULT 'metadata-v1' NOT NULL,
  `analyzed_at` text,
  `analysis_error` text,
  `overall_confidence` real,
  `manual_verified_at` text,
  `manual_verified_by` text,
  `sermon_title` text,
  `sermon_bible_passage` text,
  `sermon_preacher` text,
  `sermon_start_seconds` integer,
  `sermon_confidence` real,
  `sermon_manually_edited` integer DEFAULT 0 NOT NULL,
  `prayer_name` text,
  `prayer_role` text,
  `prayer_start_seconds` integer,
  `prayer_confidence` real,
  `prayer_manually_edited` integer DEFAULT 0 NOT NULL,
  `raw_evidence_json` text DEFAULT '{}' NOT NULL,
  `cost_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_video_analyses_status_idx` ON `archive_video_analyses` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `archive_analysis_songs` (
  `id` text PRIMARY KEY NOT NULL,
  `video_id` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `title` text NOT NULL,
  `category` text DEFAULT 'opening' NOT NULL,
  `hymn_number` integer,
  `start_seconds` integer,
  `end_seconds` integer,
  `confidence` real DEFAULT 0 NOT NULL,
  `source` text DEFAULT 'manual' NOT NULL,
  `manually_edited` integer DEFAULT 0 NOT NULL,
  `evidence` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `archive_analysis_songs_video_idx` ON `archive_analysis_songs` (`video_id`,`sort_order`);
