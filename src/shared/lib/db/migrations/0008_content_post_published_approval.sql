ALTER TABLE "content_post" ADD COLUMN "published_approval_id" text;--> statement-breakpoint
-- Every post already published keeps the approval students see (criteria 116, 117): the one its
-- pointers name while it is live or exported. Posts published later get theirs from
-- approveAndPublish.
update content_post set published_approval_id = pointers->>'approvalId' where stage in ('live','exported') and pointers->>'approvalId' is not null;
