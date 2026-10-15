CREATE TABLE "path_showing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"course_id" text NOT NULL,
	"viewer_key" text NOT NULL,
	"future_id" text,
	"strong_on" text[] DEFAULT '{}'::text[] NOT NULL,
	"costs_on" text[] DEFAULT '{}'::text[] NOT NULL,
	"out_of_reach" boolean DEFAULT false NOT NULL,
	"over_by_k" integer,
	"redraw" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "path_showing_day_course_idx" ON "path_showing" USING btree ("day","course_id");