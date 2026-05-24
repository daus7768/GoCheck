-- Create storage bucket for bill group photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bill-assets',
  'bill-assets',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access to all files in the bucket
CREATE POLICY "bill_assets_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bill-assets');

-- Anyone can upload (MVP - lock down in Phase 2 with auth)
CREATE POLICY "bill_assets_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bill-assets');

-- Allow replacing/updating uploaded files
CREATE POLICY "bill_assets_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bill-assets');
