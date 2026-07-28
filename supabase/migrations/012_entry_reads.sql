-- Lecturas por entrada: cuándo cada integrante abrió/vio un día del diario
CREATE TABLE IF NOT EXISTS entry_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_entry_reads_date ON entry_reads(entry_date, last_read_at DESC);

ALTER TABLE entry_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_reads_select_member" ON entry_reads;
DROP POLICY IF EXISTS "entry_reads_insert_own" ON entry_reads;
DROP POLICY IF EXISTS "entry_reads_update_own" ON entry_reads;
DROP POLICY IF EXISTS "entry_reads_delete_own" ON entry_reads;

CREATE POLICY "entry_reads_select_member" ON entry_reads
  FOR SELECT TO authenticated
  USING (public.is_diary_member());

CREATE POLICY "entry_reads_insert_own" ON entry_reads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_diary_member() AND user_id = auth.uid());

CREATE POLICY "entry_reads_update_own" ON entry_reads
  FOR UPDATE TO authenticated
  USING (public.is_diary_member() AND user_id = auth.uid())
  WITH CHECK (public.is_diary_member() AND user_id = auth.uid());

CREATE POLICY "entry_reads_delete_own" ON entry_reads
  FOR DELETE TO authenticated
  USING (public.is_diary_member() AND user_id = auth.uid());
