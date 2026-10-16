CREATE TABLE "admin_update" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"institution" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"apply_by" date,
	"source_title" text NOT NULL,
	"source_checked_at" date NOT NULL,
	"audience" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_by_user_id" text,
	"approved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_update_kind_check" CHECK ("admin_update"."kind" in ('opportunity', 'rule_change', 'intake')),
	CONSTRAINT "admin_update_status_check" CHECK ("admin_update"."status" in ('draft', 'in_review', 'live'))
);
--> statement-breakpoint
ALTER TABLE "admin_update" ADD CONSTRAINT "admin_update_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_update" ADD CONSTRAINT "admin_update_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_update_status_updated_idx" ON "admin_update" USING btree ("status","updated_at");