ALTER TABLE "content_artifact" DROP CONSTRAINT "content_artifact_kind_check";--> statement-breakpoint
ALTER TABLE "content_post" DROP CONSTRAINT "content_post_kind_check";--> statement-breakpoint
ALTER TABLE "content_post" ADD COLUMN "blog_id" text;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_blog_id_content_post_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."content_post"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_post_blog_id_idx" ON "content_post" USING btree ("blog_id");--> statement-breakpoint
ALTER TABLE "content_artifact" ADD CONSTRAINT "content_artifact_kind_check" CHECK ("content_artifact"."kind" in ('source', 'facts', 'drafts', 'revision', 'layout', 'render', 'source_check', 'vision', 'override', 'settings', 'send_back', 'approval', 'market', 'caption', 'export', 'social_link', 'covers', 'ideas', 'art_plan', 'post_outline', 'blog_outline', 'blog_text', 'blog_link'));--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_kind_check" CHECK ("content_post"."kind" in ('feed', 'social', 'blog'));