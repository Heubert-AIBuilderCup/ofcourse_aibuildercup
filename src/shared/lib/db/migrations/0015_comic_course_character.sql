CREATE TABLE "comic_character" (
	"brand_id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"views" jsonb NOT NULL,
	"sheet_asset_id" text,
	"sheet_note" text,
	"approved_asset_id" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "course_id" text;--> statement-breakpoint
ALTER TABLE "comic_character" ADD CONSTRAINT "comic_character_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_post_course_id_idx" ON "content_post" USING btree ("course_id");