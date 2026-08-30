import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contentPosts = sqliteTable("content_posts", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  category: text("category").notNull().default(""),
  content: text("content").notNull().default(""),
  images: text("images").notNull().default("[]"),
  status: text("status").notNull().default("published"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  birthDate: text("birth_date").notNull().default(""),
  position: text("position").notNull().default(""),
  status: text("status").notNull().default("pending"),
  forcePasswordChange: integer("force_password_change", { mode: "boolean" })
    .notNull()
    .default(false),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const memberLoginAttempts = sqliteTable("member_login_attempts", {
  rateKey: text("rate_key").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  blockedUntil: integer("blocked_until").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const businessApplications = sqliteTable("business_applications", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  applicantName: text("applicant_name").notNull(),
  applicantPhone: text("applicant_phone").notNull(),
  businessName: text("business_name").notNull(),
  category: text("category").notNull(),
  ownerName: text("owner_name").notNull(),
  businessPhone: text("business_phone").notNull().default(""),
  address: text("address").notNull(),
  description: text("description").notNull(),
  website: text("website").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveVideos = sqliteTable("archive_videos", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  date: text("date").notNull(),
  serviceType: text("service_type").notNull(),
  title: text("title").notNull(),
  preacher: text("preacher").notNull().default(""),
  youtubeId: text("youtube_id").notNull().unique(),
  youtubeUrl: text("youtube_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull().default(""),
  durationSeconds: integer("duration_seconds"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveVideoAnalyses = sqliteTable("archive_video_analyses", {
  videoId: text("video_id").primaryKey(),
  status: text("status").notNull().default("not_started"),
  analysisVersion: text("analysis_version").notNull().default("metadata-v1"),
  analyzedAt: text("analyzed_at"),
  analysisError: text("analysis_error"),
  overallConfidence: real("overall_confidence"),
  manualVerifiedAt: text("manual_verified_at"),
  manualVerifiedBy: text("manual_verified_by"),
  sermonTitle: text("sermon_title"),
  sermonBiblePassage: text("sermon_bible_passage"),
  sermonPreacher: text("sermon_preacher"),
  sermonStartSeconds: integer("sermon_start_seconds"),
  sermonConfidence: real("sermon_confidence"),
  sermonManuallyEdited: integer("sermon_manually_edited", { mode: "boolean" }).notNull().default(false),
  prayerName: text("prayer_name"),
  prayerRole: text("prayer_role"),
  prayerStartSeconds: integer("prayer_start_seconds"),
  prayerConfidence: real("prayer_confidence"),
  prayerManuallyEdited: integer("prayer_manually_edited", { mode: "boolean" }).notNull().default(false),
  rawEvidenceJson: text("raw_evidence_json").notNull().default("{}"),
  costJson: text("cost_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveAnalysisSongs = sqliteTable("archive_analysis_songs", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
  category: text("category").notNull().default("opening"),
  hymnNumber: integer("hymn_number"),
  startSeconds: integer("start_seconds"),
  endSeconds: integer("end_seconds"),
  confidence: real("confidence").notNull().default(0),
  source: text("source").notNull().default("manual"),
  manuallyEdited: integer("manually_edited", { mode: "boolean" }).notNull().default(false),
  evidence: text("evidence").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveSongs = sqliteTable("archive_songs", {
  id: text("id").primaryKey(),
  displayTitle: text("display_title").notNull(),
  baseTitle: text("base_title").notNull(),
  normalizedBaseTitle: text("normalized_base_title").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveSongNames = sqliteTable("archive_song_names", {
  id: text("id").primaryKey(),
  songId: text("song_id").notNull(),
  aliasText: text("alias_text").notNull(),
  normalizedAlias: text("normalized_alias").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveVideoSongs = sqliteTable("archive_video_songs", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull(),
  songId: text("song_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveSongConflicts = sqliteTable("archive_song_conflicts", {
  id: text("id").primaryKey(),
  inputTitle: text("input_title").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  candidateSongIdsJson: text("candidate_song_ids_json").notNull().default("[]"),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: text("resolved_at"),
});

export const memberAppAccess = sqliteTable(
  "member_app_access",
  {
    memberId: text("member_id").notNull(),
    appCode: text("app_code").notNull(),
    accessLevel: text("access_level").notNull().default("none"),
    grantedBy: text("granted_by"),
    grantedAt: text("granted_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.appCode] })],
);
