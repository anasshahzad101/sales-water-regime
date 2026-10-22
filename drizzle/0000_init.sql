CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`entity` varchar(24) NOT NULL,
	`entity_id` int,
	`action` varchar(40) NOT NULL,
	`detail` text,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`province` varchar(80),
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(240) NOT NULL,
	`brand` varchar(240),
	`plant_unit` varchar(240),
	`parent_group_id` int,
	`sector_id` int,
	`sub_sector_id` int,
	`city_id` int,
	`priority` varchar(4),
	`lead_source` varchar(40),
	`water_need` text,
	`capacity_mld` decimal(10,3),
	`website` varchar(240),
	`notes` text,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`owner_id` int,
	`owner_since` datetime(3),
	`created_by_id` int,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`title` varchar(160),
	`email` varchar(160),
	`phone` varchar(60),
	`linkedin` varchar(240),
	`is_primary` boolean NOT NULL DEFAULT false,
	`verified` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`company_id` int NOT NULL,
	`owner_id` int,
	`stage` varchar(16) NOT NULL DEFAULT 'lead',
	`stage_entered_at` datetime(3) NOT NULL,
	`previous_stage` varchar(16),
	`previous_stage_entered_at` datetime(3),
	`solution_type` varchar(16),
	`value_pkr` decimal(16,2),
	`probability` int NOT NULL DEFAULT 10,
	`expected_close` date,
	`lost_reason` varchar(80),
	`lost_note` text,
	`notes` text,
	`closed_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parent_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	CONSTRAINT `parent_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `parent_groups_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deal_id` int NOT NULL,
	`reference` varchar(80),
	`submitted_on` date,
	`amount_pkr` decimal(16,2),
	`status` varchar(16) NOT NULL DEFAULT 'Submitted',
	`notes` text,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	CONSTRAINT `sectors_id` PRIMARY KEY(`id`),
	CONSTRAINT `sectors_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sub_sectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`sector_id` int NOT NULL,
	CONSTRAINT `sub_sectors_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sub_sector` UNIQUE(`sector_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`password_hash` varchar(120) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'sales',
	`region` varchar(80),
	`is_active` boolean NOT NULL DEFAULT true,
	`must_change_password` boolean NOT NULL DEFAULT true,
	`session_version` int NOT NULL DEFAULT 1,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`deal_id` int,
	`salesperson_id` int NOT NULL,
	`visit_type` varchar(32) NOT NULL DEFAULT 'Visit',
	`visit_at` datetime(3) NOT NULL,
	`contact_met` varchar(240),
	`discussion` text,
	`outcome` varchar(16) NOT NULL DEFAULT 'pending',
	`skip_reason` varchar(80),
	`late_reason` text,
	`outcome_note` text,
	`outcome_set_at` datetime(3),
	`next_action` varchar(240),
	`next_action_date` date,
	`next_action_done_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_parent_group_id_parent_groups_id_fk` FOREIGN KEY (`parent_group_id`) REFERENCES `parent_groups`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_sector_id_sectors_id_fk` FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_sub_sector_id_sub_sectors_id_fk` FOREIGN KEY (`sub_sector_id`) REFERENCES `sub_sectors`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_city_id_cities_id_fk` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deals` ADD CONSTRAINT `deals_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deals` ADD CONSTRAINT `deals_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_deal_id_deals_id_fk` FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sub_sectors` ADD CONSTRAINT `sub_sectors_sector_id_sectors_id_fk` FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_deal_id_deals_id_fk` FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_salesperson_id_users_id_fk` FOREIGN KEY (`salesperson_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `ix_audit_entity` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `ix_company_name` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `ix_company_owner` ON `companies` (`owner_id`);--> statement-breakpoint
CREATE INDEX `ix_company_sector` ON `companies` (`sector_id`);--> statement-breakpoint
CREATE INDEX `ix_company_city` ON `companies` (`city_id`);--> statement-breakpoint
CREATE INDEX `ix_contact_company` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE INDEX `ix_deal_company` ON `deals` (`company_id`);--> statement-breakpoint
CREATE INDEX `ix_deal_owner` ON `deals` (`owner_id`);--> statement-breakpoint
CREATE INDEX `ix_deal_stage` ON `deals` (`stage`);--> statement-breakpoint
CREATE INDEX `ix_proposal_deal` ON `proposals` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ix_visit_company` ON `visits` (`company_id`);--> statement-breakpoint
CREATE INDEX `ix_visit_salesperson` ON `visits` (`salesperson_id`,`outcome`);--> statement-breakpoint
CREATE INDEX `ix_visit_deal` ON `visits` (`deal_id`);--> statement-breakpoint
CREATE INDEX `ix_visit_at` ON `visits` (`visit_at`);