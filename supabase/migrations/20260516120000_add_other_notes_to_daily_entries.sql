-- Journal: free-form "other thoughts" field (auto-saved from app)
ALTER TABLE daily_entries
ADD COLUMN IF NOT EXISTS other_notes text;

COMMENT ON COLUMN daily_entries.other_notes IS 'Optional journal notes; auto-saved from Journal screen';
