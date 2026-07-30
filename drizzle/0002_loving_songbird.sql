CREATE TABLE `business_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`applicant_name` text NOT NULL,
	`applicant_phone` text NOT NULL,
	`business_name` text NOT NULL,
	`category` text NOT NULL,
	`owner_name` text NOT NULL,
	`business_phone` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`description` text NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
