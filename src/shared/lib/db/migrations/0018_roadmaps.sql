CREATE TABLE "roadmap" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relative" jsonb,
	"coins" jsonb,
	"choices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_step" text DEFAULT 'picture' NOT NULL,
	"copied_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "roadmap_last_step_check" CHECK ("roadmap"."last_step" in ('picture', 'facts', 'study', 'living', 'after', 'futures', 'attention')),
	CONSTRAINT "roadmap_name_check" CHECK ("roadmap"."name" is null or char_length("roadmap"."name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "student_profile" DROP CONSTRAINT "student_profile_last_step_check";--> statement-breakpoint
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_copied_from_roadmap_id_fk" FOREIGN KEY ("copied_from") REFERENCES "public"."roadmap"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roadmap_user_idx" ON "roadmap" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_one_unfinished" ON "roadmap" USING btree ("user_id") WHERE finished_at is null and deleted_at is null;--> statement-breakpoint
-- Every profile's answers move into her first roadmap before the columns drop: finished when she
-- had pressed "Go to your road" (onboarded_at set), else the roadmap she is still answering. A
-- finished one counts as opened then (she saw it on /road), so it is not tagged New.
INSERT INTO "roadmap" ("id", "user_id", "answers", "relative", "coins", "last_step", "created_at", "finished_at", "last_opened_at")
SELECT gen_random_uuid()::text, "user_id", "answers", "relative", "coins", "last_step", "created_at", "onboarded_at", "onboarded_at"
FROM "student_profile";--> statement-breakpoint
ALTER TABLE "student_profile" DROP COLUMN "answers";--> statement-breakpoint
ALTER TABLE "student_profile" DROP COLUMN "relative";--> statement-breakpoint
ALTER TABLE "student_profile" DROP COLUMN "coins";--> statement-breakpoint
ALTER TABLE "student_profile" DROP COLUMN "last_step";--> statement-breakpoint
ALTER TABLE "student_profile" DROP COLUMN "onboarded_at";