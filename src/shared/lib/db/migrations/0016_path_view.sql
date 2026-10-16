CREATE TABLE "path_view" (
	"day" date NOT NULL,
	"course_id" text NOT NULL,
	"viewer_key" text NOT NULL,
	CONSTRAINT "path_view_day_course_id_viewer_key_pk" PRIMARY KEY("day","course_id","viewer_key")
);
--> statement-breakpoint
CREATE INDEX "path_view_day_idx" ON "path_view" USING btree ("day");