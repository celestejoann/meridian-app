-- Optional notes on habit completions (check-in flow)
ALTER TABLE habit_completions
ADD COLUMN IF NOT EXISTS note text;

COMMENT ON COLUMN habit_completions.note IS 'Optional note from daily check-in swipe flow';

-- Free-form notes from wildcard check-in card
CREATE TABLE IF NOT EXISTS general_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS general_notes_user_id_created_at_idx
  ON general_notes (user_id, created_at DESC);

ALTER TABLE general_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own general notes"
  ON general_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own general notes"
  ON general_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON general_notes TO authenticated;
