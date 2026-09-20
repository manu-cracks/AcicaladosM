-- ==============================================================================
-- MIGRACIÓN: CREACIÓN DE BUCKET 'products' Y POLÍTICAS RLS EN SUPABASE STORAGE
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Crear o actualizar el bucket público 'products'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- 2. Asegurar RLS en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas previas para el bucket products
DROP POLICY IF EXISTS "public_read_products" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_insert_products" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_products" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_products" ON storage.objects;

-- 4. Política de lectura pública (SELECT) para el bucket products
CREATE POLICY "public_read_products" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'products');

-- 5. Política de inserción (INSERT) para usuarios autenticados
CREATE POLICY "authenticated_insert_products" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products');

-- 6. Políticas de actualización (UPDATE) y eliminación (DELETE) para usuarios autenticados
CREATE POLICY "authenticated_update_products" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'products')
  WITH CHECK (bucket_id = 'products');

CREATE POLICY "authenticated_delete_products" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'products');
