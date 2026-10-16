CREATE TABLE "student_ask" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"roadmap_id" text NOT NULL,
	"tile_id" text NOT NULL,
	"question" text NOT NULL,
	"reply" text NOT NULL,
	"outcome" text NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roadmap" ADD COLUMN "own_words" jsonb;--> statement-breakpoint
ALTER TABLE "roadmap" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "student_ask" ADD CONSTRAINT "student_ask_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ask" ADD CONSTRAINT "student_ask_roadmap_id_roadmap_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_ask_user_day_idx" ON "student_ask" USING btree ("user_id","day");