CREATE TABLE `__new_problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site` text NOT NULL,
	`external_problem_id` text NOT NULL,
	`external_problem_link` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_problems` SELECT `id`, `site`, `external_problem_id`, COALESCE(`external_problem_link`, ''), `status`, `created_at`, `updated_at`, `deleted_at` FROM `problems`;
--> statement-breakpoint
CREATE TABLE `__new_translations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`problem_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`problem_id`) REFERENCES `__new_problems`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_translations` SELECT `id`, `problem_id`, `author_id`, `content`, `status`, `created_at`, `updated_at`, `deleted_at` FROM `translations`;
--> statement-breakpoint
DROP TABLE `translations`;
--> statement-breakpoint
DROP TABLE `problems`;
--> statement-breakpoint
ALTER TABLE `__new_problems` RENAME TO `problems`;
--> statement-breakpoint
ALTER TABLE `__new_translations` RENAME TO `translations`;
--> statement-breakpoint
CREATE UNIQUE INDEX `problems_site_external_problem_id_idx` ON `problems` (`site`,`external_problem_id`);
--> statement-breakpoint
CREATE INDEX `translations_problem_id_idx` ON `translations` (`problem_id`);
--> statement-breakpoint
CREATE INDEX `translations_author_id_idx` ON `translations` (`author_id`);
