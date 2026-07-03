-- Pursuits rebuild: optional coaching "shape" on goals + moment log feed.
-- Does not modify or drop tasks, identity_milestones, or goal_metrics_snapshots.

-- 1) Optional pursuit shape (coaching situation)
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS shape text;

ALTER TABLE goals
DROP CONSTRAINT IF EXISTS goals_shape_check;

ALTER TABLE goals
ADD CONSTRAINT goals_shape_check
CHECK (
  shape IS NULL
  OR shape IN ('get_back_to', 'working_toward', 'messy_middle', 'someday')
);

COMMENT ON COLUMN goals.shape IS
  'Optional coaching situation: get_back_to, working_toward, messy_middle, someday';

-- 2) Pursuit moments — low-structure log entries (replaces tasks for new Pursuits UI)
CREATE TABLE IF NOT EXISTS pursuit_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pursuit_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pursuit_moments_source_check
    CHECK (source IN ('manual', 'revisit_answer'))
);

CREATE INDEX IF NOT EXISTS pursuit_moments_pursuit_id_created_at_idx
  ON pursuit_moments (pursuit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pursuit_moments_user_id_created_at_idx
  ON pursuit_moments (user_id, created_at DESC);

COMMENT ON TABLE pursuit_moments IS
  'Chronological moment log for a pursuit; manual entries and Revisit flow answers';
COMMENT ON COLUMN pursuit_moments.source IS
  'manual = user-added moment; revisit_answer = captured from Revisit flow';

ALTER TABLE pursuit_moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pursuit moments" ON pursuit_moments;
DROP POLICY IF EXISTS "Users can insert own pursuit moments" ON pursuit_moments;
DROP POLICY IF EXISTS "Users can update own pursuit moments" ON pursuit_moments;
DROP POLICY IF EXISTS "Users can delete own pursuit moments" ON pursuit_moments;

CREATE POLICY "Users can read own pursuit moments"
  ON pursuit_moments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pursuit moments"
  ON pursuit_moments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM goals g
      WHERE g.id = pursuit_id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own pursuit moments"
  ON pursuit_moments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM goals g
      WHERE g.id = pursuit_id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own pursuit moments"
  ON pursuit_moments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON pursuit_moments TO authenticated;
