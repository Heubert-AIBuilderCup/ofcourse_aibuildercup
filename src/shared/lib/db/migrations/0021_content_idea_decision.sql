CREATE TABLE "content_idea_decision" (
	"idea_id" text PRIMARY KEY NOT NULL,
	"decision" text NOT NULL,
	"post_id" text,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_idea_decision_decision_check" CHECK ("content_idea_decision"."decision" in ('accepted', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "content_idea_decision" ADD CONSTRAINT "content_idea_decision_post_id_content_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."content_post"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_idea_decision" ADD CONSTRAINT "content_idea_decision_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;