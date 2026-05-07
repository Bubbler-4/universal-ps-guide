PRAGMA foreign_keys=OFF;
--> statement-breakpoint
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
INSERT INTO `__new_problems` SELECT `id`, `site`, `external_problem_id`, `external_problem_link`, `status`, `created_at`, `updated_at`, `deleted_at` FROM `problems`;
--> statement-breakpoint
DROP TABLE `problems`;
--> statement-breakpoint
ALTER TABLE `__new_problems` RENAME TO `problems`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `problems_site_external_problem_id_idx` ON `problems` (`site`,`external_problem_id`);
