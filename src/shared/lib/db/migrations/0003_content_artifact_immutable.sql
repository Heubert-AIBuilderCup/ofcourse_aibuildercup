CREATE OR REPLACE FUNCTION content_artifact_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'content_artifact rows are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER content_artifact_no_update BEFORE UPDATE ON content_artifact
  FOR EACH ROW EXECUTE FUNCTION content_artifact_immutable();
--> statement-breakpoint
CREATE TRIGGER content_asset_no_update BEFORE UPDATE ON content_asset
  FOR EACH ROW EXECUTE FUNCTION content_artifact_immutable();
