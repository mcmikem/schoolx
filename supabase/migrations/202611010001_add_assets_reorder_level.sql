-- Add reorder_level column to assets table for inventory threshold alerts
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0;

-- Index for efficient querying of low-stock items
CREATE INDEX IF NOT EXISTS idx_assets_reorder_level
  ON public.assets (school_id, reorder_level);
