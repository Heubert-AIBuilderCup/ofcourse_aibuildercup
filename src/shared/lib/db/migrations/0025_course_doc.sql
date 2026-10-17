CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "course_doc" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"university" text NOT NULL,
	"city_id" text NOT NULL,
	"level" text NOT NULL,
	"field" text NOT NULL,
	"graph_field" text NOT NULL,
	"years" integer NOT NULL,
	"fee_k" integer NOT NULL,
	"niche" boolean NOT NULL,
	"description" text NOT NULL,
	"text_hash" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
