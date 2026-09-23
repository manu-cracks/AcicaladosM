-- ==============================================================================
-- MIGRACIÓN: CREACIÓN DE BUCKET 'empleados-fotos' Y COLUMNA 'foto_url' EN EMPLOYEES
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Crear o actualizar el bucket público 'empleados-fotos'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empleados-fotos',
  'empleados-fotos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- 2. Asegurar columna foto_url en employees
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN employees.foto_url IS 'URL pública de la fotografía de perfil del colaborador en storage bucket empleados-fotos';

-- 3. Políticas RLS en storage.objects para empleados-fotos
DROP POLICY IF EXISTS "public_read_empleados_fotos" ON storage.objects;
CREATE POLICY "public_read_empleados_fotos" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'empleados-fotos');

DROP POLICY IF EXISTS "allow_upload_empleados_fotos" ON storage.objects;
CREATE POLICY "allow_upload_empleados_fotos" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'empleados-fotos');

DROP POLICY IF EXISTS "allow_update_empleados_fotos" ON storage.objects;
CREATE POLICY "allow_update_empleados_fotos" ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'empleados-fotos')
  WITH CHECK (bucket_id = 'empleados-fotos');

DROP POLICY IF EXISTS "allow_delete_empleados_fotos" ON storage.objects;
CREATE POLICY "allow_delete_empleados_fotos" ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'empleados-fotos');
