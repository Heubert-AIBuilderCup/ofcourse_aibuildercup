CREATE TABLE "student_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"persona" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relative" jsonb,
	"coins" jsonb,
	"reminders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_step" text DEFAULT 'picture' NOT NULL,
	"seen_futures" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profile_persona_check" CHECK ("student_profile"."persona" is null or "student_profile"."persona" in ('male', 'female', 'neutral')),
	CONSTRAINT "student_profile_last_step_check" CHECK ("student_profile"."last_step" in ('picture', 'facts', 'study', 'living', 'after', 'futures', 'attention'))
);
--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;