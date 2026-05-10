CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `collections_author_id_idx` ON `collections` (`author_id`);
--> statement-breakpoint
CREATE TABLE `collection_problems` (
	`collection_id` integer NOT NULL,
	`problem_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `problem_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_problems_collection_id_position_idx` ON `collection_problems` (`collection_id`,`position`);
--> statement-breakpoint
CREATE INDEX `collection_problems_problem_id_idx` ON `collection_problems` (`problem_id`);
