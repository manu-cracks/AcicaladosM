-- ==============================================================================
-- MIGRACIÓN DE ROL VESTUARIO_ADMIN Y POLÍTICAS RLS EXCLUSIVAS
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. ACTUALIZAR CONSTRAINT DE ROLES EN public.profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text, 'cliente'::text, 'VESTUARIO_ADMIN'::text]));

-- 2. ACTUALIZAR FUNCIÓN TRIGGER handle_new_user EN public
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text := 'cliente';
  user_email text;
BEGIN
  user_email := LOWER(COALESCE(NEW.email, ''));

  -- Asignación estricta de roles específicos
  IF user_email IN ('enzocostareyes@gmail.com', 'spaacicaladosbarbershop@gmail.com') THEN
    assigned_role := 'admin';
  ELSIF user_email = 'spaicort@gmail.com' THEN
    assigned_role := 'recepcionista';
  ELSIF user_email = 'vepeja4602@bullbaby.com' THEN
    assigned_role := 'VESTUARIO_ADMIN';
  ELSE
    assigned_role := 'cliente';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 1),
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'last_name',
      substr(
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        length(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 1)) + 2
      ),
      ''
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE public.profiles.first_name END,
    last_name = CASE WHEN EXCLUDED.last_name <> '' THEN EXCLUDED.last_name ELSE public.profiles.last_name END,
    avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE public.profiles.avatar_url END,
    role = assigned_role;

  RETURN NEW;
END;
$$;

-- 3. ASIGNAR ROL VESTUARIO_ADMIN AL USUARIO vepeja4602@bullbaby.com
UPDATE public.profiles
SET role = 'VESTUARIO_ADMIN'
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = 'vepeja4602@bullbaby.com'
);

-- 4. POLÍTICAS RLS PARA TABLAS DE VESTUARIO
-- 4.1 wardrobe_items
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wardrobe_items_all_vestuario_admin" ON public.wardrobe_items;
CREATE POLICY "wardrobe_items_all_vestuario_admin" ON public.wardrobe_items
  FOR ALL
  TO authenticated
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN')
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN');

-- 4.2 wardrobe_movements
ALTER TABLE public.wardrobe_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wardrobe_movements_all_vestuario_admin" ON public.wardrobe_movements;
CREATE POLICY "wardrobe_movements_all_vestuario_admin" ON public.wardrobe_movements
  FOR ALL
  TO authenticated
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN')
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN');

-- 4.3 dress_rentals
ALTER TABLE public.dress_rentals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dress_rentals_all_vestuario_admin" ON public.dress_rentals;
CREATE POLICY "dress_rentals_all_vestuario_admin" ON public.dress_rentals
  FOR ALL
  TO authenticated
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN')
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN');

-- 4.4 storage.objects para el bucket 'wardrobe-images'
DROP POLICY IF EXISTS "vestuario_admin_storage_wardrobe_images" ON storage.objects;
CREATE POLICY "vestuario_admin_storage_wardrobe_images" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'wardrobe-images' 
    AND COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN'
  )
  WITH CHECK (
    bucket_id = 'wardrobe-images' 
    AND COALESCE(public.get_user_role(), private.get_user_role()) = 'VESTUARIO_ADMIN'
  );

-- 5. BLINDAJE Y DENEGACIÓN EXPLÍCITA EN TABLAS AJENAS
-- 5.1 Ventas: ventas_mostrador y ventas_mostrador_detalles
DROP POLICY IF EXISTS "ventas_mostrador_delete_all" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_insert_all" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_select_all" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_update_all" ON public.ventas_mostrador;

DROP POLICY IF EXISTS "Permitir insercion para todos" ON public.ventas_mostrador_detalles;
DROP POLICY IF EXISTS "Permitir lectura para todos" ON public.ventas_mostrador_detalles;

DROP POLICY IF EXISTS "ventas_mostrador_detalles_select_staff" ON public.ventas_mostrador_detalles;
CREATE POLICY "ventas_mostrador_detalles_select_staff" ON public.ventas_mostrador_detalles
  FOR SELECT
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "ventas_mostrador_detalles_insert_staff" ON public.ventas_mostrador_detalles;
CREATE POLICY "ventas_mostrador_detalles_insert_staff" ON public.ventas_mostrador_detalles
  FOR INSERT
  TO public
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "ventas_mostrador_detalles_update_staff" ON public.ventas_mostrador_detalles;
CREATE POLICY "ventas_mostrador_detalles_update_staff" ON public.ventas_mostrador_detalles
  FOR UPDATE
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]))
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "ventas_mostrador_detalles_delete_admin" ON public.ventas_mostrador_detalles;
CREATE POLICY "ventas_mostrador_detalles_delete_admin" ON public.ventas_mostrador_detalles
  FOR DELETE
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'admin'::text);

-- 5.2 Asistencia: employee_attendances y attendance_breaks
DROP POLICY IF EXISTS "employee_attendances_allow_all" ON public.employee_attendances;
DROP POLICY IF EXISTS "employee_attendances_staff_select" ON public.employee_attendances;
CREATE POLICY "employee_attendances_staff_select" ON public.employee_attendances
  FOR SELECT
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "employee_attendances_staff_insert" ON public.employee_attendances;
CREATE POLICY "employee_attendances_staff_insert" ON public.employee_attendances
  FOR INSERT
  TO public
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "employee_attendances_staff_update" ON public.employee_attendances;
CREATE POLICY "employee_attendances_staff_update" ON public.employee_attendances
  FOR UPDATE
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]))
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "employee_attendances_admin_delete" ON public.employee_attendances;
CREATE POLICY "employee_attendances_admin_delete" ON public.employee_attendances
  FOR DELETE
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'admin'::text);

DROP POLICY IF EXISTS "attendance_breaks_allow_all" ON public.attendance_breaks;
DROP POLICY IF EXISTS "attendance_breaks_staff_select" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_staff_select" ON public.attendance_breaks
  FOR SELECT
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "attendance_breaks_staff_insert" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_staff_insert" ON public.attendance_breaks
  FOR INSERT
  TO public
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "attendance_breaks_staff_update" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_staff_update" ON public.attendance_breaks
  FOR UPDATE
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]))
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "attendance_breaks_admin_delete" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_admin_delete" ON public.attendance_breaks
  FOR DELETE
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'admin'::text);

-- 5.3 attendance_justifications & attendance_settings
DROP POLICY IF EXISTS "attendance_justifications_all" ON public.attendance_justifications;
DROP POLICY IF EXISTS "attendance_justifications_staff" ON public.attendance_justifications;
CREATE POLICY "attendance_justifications_staff" ON public.attendance_justifications
  FOR ALL
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]))
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text, 'empleado'::text]));

DROP POLICY IF EXISTS "attendance_settings_write_policy" ON public.attendance_settings;
CREATE POLICY "attendance_settings_write_policy" ON public.attendance_settings
  FOR ALL
  TO public
  USING (COALESCE(public.get_user_role(), private.get_user_role()) = 'admin'::text)
  WITH CHECK (COALESCE(public.get_user_role(), private.get_user_role()) = 'admin'::text);
