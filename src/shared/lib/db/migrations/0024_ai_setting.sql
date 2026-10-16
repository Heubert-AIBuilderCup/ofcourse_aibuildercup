CREATE TABLE "ai_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failing" text,
	"failing_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_setting_change" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"user_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_setting" ADD CONSTRAINT "ai_setting_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_setting_change" ADD CONSTRAINT "ai_setting_change_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;