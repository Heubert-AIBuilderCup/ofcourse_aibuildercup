CREATE TABLE "ai_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"use_case" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_call" (
	"id" text PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"use_case" text NOT NULL,
	"tier" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"ok" boolean NOT NULL,
	"cached" boolean NOT NULL,
	"ms" integer NOT NULL,
	"fallback" text,
	"post_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_call_tier_check" CHECK ("ai_call"."tier" in ('flash', 'pro', 'image'))
);
--> statement-breakpoint
CREATE TABLE "content_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_artifact_kind_check" CHECK ("content_artifact"."kind" in ('source', 'facts', 'drafts', 'revision', 'layout', 'render', 'source_check', 'vision', 'override', 'settings', 'send_back', 'approval', 'market', 'caption', 'export', 'social_link'))
);
--> statement-breakpoint
CREATE TABLE "content_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_post" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"stage" text NOT NULL,
	"pointers" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_post_kind_check" CHECK ("content_post"."kind" in ('feed', 'social')),
	CONSTRAINT "content_post_stage_check" CHECK ("content_post"."stage" in ('source', 'structures', 'approved', 'rendered', 'in_review', 'ready', 'live', 'exported'))
);
--> statement-breakpoint
CREATE TABLE "content_step" (
	"post_id" text NOT NULL,
	"step" text NOT NULL,
	"status" text NOT NULL,
	"started_version" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "content_step_post_id_step_pk" PRIMARY KEY("post_id","step"),
	CONSTRAINT "content_step_status_check" CHECK ("content_step"."status" in ('running', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "role_invite" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "role_invite" ADD COLUMN "editor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "role_invite" ADD COLUMN "reviewer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "editor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "reviewer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_artifact" ADD CONSTRAINT "content_artifact_post_id_content_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_artifact" ADD CONSTRAINT "content_artifact_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_parent_id_content_post_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post" ADD CONSTRAINT "content_post_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_step" ADD CONSTRAINT "content_step_post_id_content_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."content_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_call_day_tier_idx" ON "ai_call" USING btree ("day","tier");--> statement-breakpoint
CREATE INDEX "content_artifact_post_id_idx" ON "content_artifact" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "content_post_stage_idx" ON "content_post" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "content_post_parent_id_idx" ON "content_post" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "role_invite" ADD CONSTRAINT "role_invite_has_something" CHECK ("role_invite"."role" is not null or "role_invite"."editor" or "role_invite"."reviewer");