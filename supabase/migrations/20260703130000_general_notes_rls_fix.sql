-- Ensure authenticated users can read/insert their own general_notes rows.
-- Idempotent: safe to re-run if policies were missing or created without role grants.

ALTER TABLE general_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own general notes" ON general_notes;
DROP POLICY IF EXISTS "Users can insert own general notes" ON general_notes;

CREATE POLICY "Users can read own general notes"
  ON general_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own general notes"
  ON general_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON general_notes TO authenticated;
