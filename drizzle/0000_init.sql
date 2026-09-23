CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`user_id` text,
	`client_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_firm_idx` ON `activity_logs` (`firm_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_client_idx` ON `activity_logs` (`client_id`);--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'Client Meeting' NOT NULL,
	`client_id` text,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_firm_date_idx` ON `calendar_events` (`firm_id`,`date`);--> statement-breakpoint
CREATE TABLE `client_services` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`service` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_services_uq` ON `client_services` (`client_id`,`service`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`trade_name` text,
	`mobile` text,
	`email` text,
	`address` text,
	`city` text,
	`state` text,
	`pan` text,
	`gstin` text,
	`tan` text,
	`udyam` text,
	`business_type` text,
	`constitution` text,
	`financial_year` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`manager_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `clients_firm_idx` ON `clients` (`firm_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_firm_code_uq` ON `clients` (`firm_id`,`code`);--> statement-breakpoint
CREATE INDEX `clients_pan_idx` ON `clients` (`pan`);--> statement-breakpoint
CREATE INDEX `clients_gstin_idx` ON `clients` (`gstin`);--> statement-breakpoint
CREATE TABLE `cma_records` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`financial_year` text NOT NULL,
	`period` text NOT NULL,
	`purpose` text NOT NULL,
	`bank` text,
	`loan_amount` integer,
	`status` text DEFAULT 'Draft' NOT NULL,
	`due_date` text,
	`assigned_to` text,
	`inputs` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`report_generated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cma_firm_idx` ON `cma_records` (`firm_id`);--> statement-breakpoint
CREATE INDEX `cma_client_idx` ON `cma_records` (`client_id`);--> statement-breakpoint
CREATE TABLE `compliance_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`category` text NOT NULL,
	`compliance_type` text NOT NULL,
	`period` text NOT NULL,
	`financial_year` text NOT NULL,
	`due_date` text NOT NULL,
	`assigned_to` text,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Not Started' NOT NULL,
	`filed_date` text,
	`acknowledgement` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `compliance_firm_idx` ON `compliance_tasks` (`firm_id`);--> statement-breakpoint
CREATE INDEX `compliance_client_idx` ON `compliance_tasks` (`client_id`);--> statement-breakpoint
CREATE INDEX `compliance_due_idx` ON `compliance_tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `compliance_types` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`periodicity` text DEFAULT 'Monthly' NOT NULL,
	`default_due_day` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_types_uq` ON `compliance_types` (`firm_id`,`category`,`name`);--> statement-breakpoint
CREATE TABLE `document_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`period` text,
	`category` text DEFAULT 'GST' NOT NULL,
	`compliance_task_id` text,
	`requested_at` text,
	`due_date` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`compliance_task_id`) REFERENCES `compliance_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `doc_checklists_firm_idx` ON `document_checklists` (`firm_id`);--> statement-breakpoint
CREATE INDEX `doc_checklists_client_idx` ON `document_checklists` (`client_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`checklist_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`storage_key` text,
	`file_name` text,
	`mime_type` text,
	`size_bytes` integer,
	`received_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checklist_id`) REFERENCES `document_checklists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documents_checklist_idx` ON `documents` (`checklist_id`);--> statement-breakpoint
CREATE INDEX `documents_client_idx` ON `documents` (`client_id`);--> statement-breakpoint
CREATE TABLE `dsc_records` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`holder_name` text NOT NULL,
	`dsc_class` text DEFAULT 'Class 3',
	`issue_date` text NOT NULL,
	`expiry_date` text NOT NULL,
	`renewal_status` text DEFAULT 'Active' NOT NULL,
	`custody` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dsc_firm_idx` ON `dsc_records` (`firm_id`);--> statement-breakpoint
CREATE TABLE `firms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`gstin` text,
	`pan` text,
	`email` text,
	`phone` text,
	`address` text,
	`state` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`service` text NOT NULL,
	`description` text,
	`amount` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`number` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`billing_period` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`gst_rate` integer DEFAULT 18 NOT NULL,
	`gst_amount` integer NOT NULL,
	`total` integer NOT NULL,
	`notes` text,
	`recurring_bill_id` text,
	`sent_at` text,
	`sent_via` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recurring_bill_id`) REFERENCES `recurring_bills`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invoices_firm_idx` ON `invoices` (`firm_id`);--> statement-breakpoint
CREATE INDEX `invoices_client_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_firm_number_uq` ON `invoices` (`firm_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_recurring_period_uq` ON `invoices` (`recurring_bill_id`,`billing_period`);--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`department` text NOT NULL,
	`notice_type` text NOT NULL,
	`section` text,
	`notice_date` text NOT NULL,
	`due_date` text,
	`reference` text,
	`assigned_to` text,
	`status` text DEFAULT 'New' NOT NULL,
	`response_date` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notices_firm_idx` ON `notices` (`firm_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`href` text,
	`dedupe_key` text,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_uq` ON `notifications` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`invoice_id` text,
	`payment_date` text NOT NULL,
	`amount` integer NOT NULL,
	`mode` text NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_firm_idx` ON `payments` (`firm_id`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `recurring_bill_items` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`recurring_bill_id` text NOT NULL,
	`service` text NOT NULL,
	`description` text,
	`amount` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_bill_id`) REFERENCES `recurring_bills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`client_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`frequency` text DEFAULT 'Monthly' NOT NULL,
	`interval_months` integer DEFAULT 1 NOT NULL,
	`next_period_start` text NOT NULL,
	`due_days` integer DEFAULT 15 NOT NULL,
	`gst_rate` integer DEFAULT 18 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recurring_firm_idx` ON `recurring_bills` (`firm_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_client_uq` ON `recurring_bills` (`client_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_firm_key_uq` ON `settings` (`firm_id`,`key`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`title` text NOT NULL,
	`client_id` text,
	`category` text DEFAULT 'Other' NOT NULL,
	`assigned_to` text,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'Not Started' NOT NULL,
	`completed_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_firm_idx` ON `tasks` (`firm_id`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assigned_to`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`designation` text,
	`client_id` text,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_firm_idx` ON `users` (`firm_id`);