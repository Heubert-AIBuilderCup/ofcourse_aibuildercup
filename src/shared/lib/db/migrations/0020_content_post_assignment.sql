ALTER TABLE "content_post" ADD COLUMN "assignee_user_id" text;--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "assignment_note" text;--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "assigned_by_user_id" text;--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;