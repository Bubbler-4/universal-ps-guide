ALTER TABLE `users` ADD `github_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_github_id_unique` ON `users` (`github_id`);
