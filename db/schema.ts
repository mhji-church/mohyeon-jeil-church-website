import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
