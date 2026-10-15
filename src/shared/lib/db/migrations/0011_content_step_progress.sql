ALTER TABLE "content_step" ADD COLUMN "progress" jsonb;--> statement-breakpoint
ALTER TABLE "content_step" ADD COLUMN "beat_at" timestamp with time zone;