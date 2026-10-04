-- ==============================================================================
-- MIGRACIÓN: RESTRICCIÓN DE BORRADO FÍSICO (DELETE) A ADMIN,
-- FLUJO DE SOLICITUD DE ELIMINACIÓN Y RETENCIÓN DE GARANTÍAS EN VESTUARIO
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. AGREGAR COLUMNAS PARA SOLICITUD DE ELIMINACIÓN Y GARANTÍAS
ALTER TABLE public.dress_rentals 
  ADD COLUMN IF NOT EXISTS solicita_eliminacion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS garantia_devuelta numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garantia_retenida numeric DEFAULT 0;

-- 2. POLÍTICAS RLS EN DRESS_RENTALS (DELETE EXCLUSIVO PARA ADMIN)
DROP POLICY IF EXISTS "dress_rentals_all_admin_recep" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_all_vestuario_admin" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_staff_select" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_staff_insert" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_staff_update" ON public.dress_rentals;
DROP POLICY IF EXISTS "dress_rentals_delete_admin" ON public.dress_rentals;

-- Lectura para personal administrativo y modistas
CREATE POLICY "dress_rentals_staff_select" ON public.dress_rentals
  FOR SELECT
  TO public
  USING (
    COALESCE(public.get_user_role(), private.get_user_role()) IN ('admin', 'recepcionista', 'VESTUARIO_ADMIN')
    OR current_user = 'postgres'
  );

-- Inserción para personal
CREATE POLICY "dress_rentals_staff_insert" ON public.dress_rentals
  FOR INSERT
  TO public
  WITH CHECK (
    COALESCE(public.get_user_role(), private.get_user_role()) IN ('admin', 'recepcionista', 'VESTUARIO_ADMIN')
    OR current_user = 'postgres'
  );

-- Actualización para personal (cambio de estados, retenciones y solicitud de eliminación)
CREATE POLICY "dress_rentals_staff_update" ON public.dress_rentals
  FOR UPDATE
  TO public
  USING (
    COALESCE(public.get_user_role(), private.get_user_role()) IN ('admin', 'recepcionista', 'VESTUARIO_ADMIN')
    OR current_user = 'postgres'
  )
  WITH CHECK (
    COALESCE(public.get_user_role(), private.get_user_role()) IN ('admin', 'recepcionista', 'VESTUARIO_ADMIN')
    OR current_user = 'postgres'
  );

-- BORRADO FÍSICO (DELETE): EXCLUSIVO Y ESTRICTO PARA ROL ADMIN
CREATE POLICY "dress_rentals_delete_admin" ON public.dress_rentals
  FOR DELETE
  TO public
  USING (
    COALESCE(public.get_user_role(), private.get_user_role()) = 'admin'
    OR current_user = 'postgres'
  );
