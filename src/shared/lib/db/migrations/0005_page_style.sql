CREATE TABLE "page_style" (
	"brand_id" text PRIMARY KEY NOT NULL,
	"art_style" text NOT NULL,
	"copy_style" text NOT NULL,
	"closest_template_id" text NOT NULL,
	"reference_asset_ids" text[] NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_style" ADD CONSTRAINT "page_style_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;