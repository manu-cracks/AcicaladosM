-- ==============================================================================
-- MIGRACIÓN: MÓDULO EGRESOS - AUDITORÍA, ANULACIÓN ESTRICTA Y CONTROL DE ACCESO (RBAC)
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
--
-- Objetivos:
-- 1. Agregar campos de auditoría ('motivo_anulacion' y 'estado') en las tablas expenses y egresos.
-- 2. Restringir UPDATE y DELETE por RLS exclusivamente para el rol 'admin'.
-- 3. Actualizar la función RPC 'get_financial_balances' para excluir estrictamente
--    cualquier gasto anulado o inactivo de los totales financieros y balances netos.
-- ==============================================================================

-- 1. Campos de Auditoría y Estado
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS motivo_anulacion text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS estado text DEFAULT 'ACTIVO';

UPDATE public.expenses 
SET estado = CASE 
  WHEN status IN ('voided', 'ELIMINADO', 'INACTIVO', 'ANULADO') OR voided_at IS NOT NULL THEN 'ANULADO'
  ELSE 'ACTIVO'
END
WHERE estado IS NULL;

ALTER TABLE public.egresos ADD COLUMN IF NOT EXISTS motivo_anulacion text;
ALTER TABLE public.egresos ADD COLUMN IF NOT EXISTS estado text DEFAULT 'ACTIVO';
ALTER TABLE public.egresos ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Políticas RLS de Seguridad en Tabla expenses
-- Solo admin puede ejecutar UPDATE (anulaciones / modificaciones)
DROP POLICY IF EXISTS "expenses_admin_update" ON public.expenses;
CREATE POLICY "expenses_admin_update" ON public.expenses
  FOR UPDATE
  TO public
  USING ((SELECT private.get_user_role()) = 'admin')
  WITH CHECK ((SELECT private.get_user_role()) = 'admin');

-- Solo admin puede ejecutar DELETE (borrado físico bloqueado para recepcionistas)
DROP POLICY IF EXISTS "expenses_admin_delete" ON public.expenses;
CREATE POLICY "expenses_admin_delete" ON public.expenses
  FOR DELETE
  TO public
  USING ((SELECT private.get_user_role()) = 'admin');

-- 3. Políticas RLS de Seguridad en Tabla egresos
DROP POLICY IF EXISTS "egresos_all_admin_recep" ON public.egresos;

DROP POLICY IF EXISTS "egresos_staff_read" ON public.egresos;
CREATE POLICY "egresos_staff_read" ON public.egresos
  FOR SELECT
  TO public
  USING ((SELECT private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "egresos_staff_insert" ON public.egresos;
CREATE POLICY "egresos_staff_insert" ON public.egresos
  FOR INSERT
  TO public
  WITH CHECK ((SELECT private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "egresos_admin_update" ON public.egresos;
CREATE POLICY "egresos_admin_update" ON public.egresos
  FOR UPDATE
  TO public
  USING ((SELECT private.get_user_role()) = 'admin')
  WITH CHECK ((SELECT private.get_user_role()) = 'admin');

DROP POLICY IF EXISTS "egresos_admin_delete" ON public.egresos;
CREATE POLICY "egresos_admin_delete" ON public.egresos
  FOR DELETE
  TO public
  USING ((SELECT private.get_user_role()) = 'admin');

-- 4. Actualización de Función RPC 'get_financial_balances' con Exclusión Rigurosa de Anulados
CREATE OR REPLACE FUNCTION public.get_financial_balances(
  p_date date DEFAULT NULL::date, 
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date,
  p_employee_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_effective_date date;
  v_ingresos_servicios integer := 0;
  v_ventas_mostrador integer := 0;
  v_egresos integer := 0;
  v_total_ingresos integer := 0;
  v_balance_neto integer := 0;
  v_citas_count integer := 0;
  v_citas_confirmadas_count integer := 0;
BEGIN
  IF p_date IS NOT NULL THEN
    v_effective_date := p_date;
    v_start_ts := (p_date::text || ' 00:00:00 America/Lima')::timestamptz;
    v_end_ts   := (p_date::text || ' 23:59:59.999 America/Lima')::timestamptz;
  ELSIF p_start_date IS NOT NULL THEN
    v_effective_date := NULL;
    v_start_ts := (p_start_date::text || ' 00:00:00 America/Lima')::timestamptz;
    v_end_ts   := (COALESCE(p_end_date, CURRENT_DATE)::text || ' 23:59:59.999 America/Lima')::timestamptz;
  ELSE
    v_effective_date := (now() AT TIME ZONE 'America/Lima')::date;
    v_start_ts := (v_effective_date::text || ' 00:00:00 America/Lima')::timestamptz;
    v_end_ts   := (v_effective_date::text || ' 23:59:59.999 America/Lima')::timestamptz;
  END IF;

  -- 1. Citas activas e ingresos de servicios
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN b.cancelled_at IS NOT NULL OR b.expired_at IS NOT NULL THEN 0
        WHEN b.payment_status = 'total' OR (COALESCE(b.total_price_cents, 0) > 0 AND COALESCE(b.advance_amount_cents, 0) >= COALESCE(b.total_price_cents, 0))
          THEN GREATEST(COALESCE(total_price_cents, 0), COALESCE(advance_amount_cents, 0))
        WHEN b.payment_status = 'parcial' OR COALESCE(b.advance_amount_cents, 0) > 0
          THEN LEAST(COALESCE(b.advance_amount_cents, 0), COALESCE(b.total_price_cents, b.advance_amount_cents))
        ELSE 0
      END
    ), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE b.payment_status IN ('total', 'parcial'))
  INTO v_ingresos_servicios, v_citas_count, v_citas_confirmadas_count
  FROM public.bookings b
  WHERE (b.cancelled_at IS NULL AND b.expired_at IS NULL)
    AND (
      (v_effective_date IS NOT NULL AND b.booking_date = v_effective_date)
      OR (v_start_ts IS NOT NULL AND v_effective_date IS NULL AND b.booking_date >= p_start_date AND b.booking_date <= COALESCE(p_end_date, CURRENT_DATE))
    )
    AND (
      p_employee_id IS NULL 
      OR b.assigned_employee_id = p_employee_id
      OR EXISTS (
        SELECT 1 FROM public.booking_services bs 
        WHERE bs.booking_id = b.id AND bs.assigned_employee_id = p_employee_id
      )
    );

  -- 2. Ventas de mostrador (solo aplican globalmente cuando no hay empleado específico seleccionado)
  IF p_employee_id IS NULL THEN
    SELECT COALESCE(SUM(ROUND(COALESCE(total, 0) * 100)::integer), 0)
    INTO v_ventas_mostrador
    FROM public.ventas_mostrador
    WHERE (
      (v_start_ts IS NOT NULL AND COALESCE(fecha, created_at) >= v_start_ts AND COALESCE(fecha, created_at) <= v_end_ts)
    );

    -- 3. Egresos operativos estrictamente activos (excluyendo ANULADO, ELIMINADO, INACTIVO, voided)
    SELECT COALESCE(SUM(amount_cents), 0)
    INTO v_egresos
    FROM public.expenses
    WHERE UPPER(COALESCE(status, 'ACTIVO')) NOT IN ('VOIDED', 'ANULADO', 'ELIMINADO', 'INACTIVO')
      AND UPPER(COALESCE(estado, 'ACTIVO')) NOT IN ('VOIDED', 'ANULADO', 'ELIMINADO', 'INACTIVO')
      AND status <> 'voided'
      AND voided_at IS NULL
      AND (
        (v_effective_date IS NOT NULL AND (expense_date = v_effective_date OR (expense_date IS NULL AND created_at >= v_start_ts AND created_at <= v_end_ts)))
        OR (v_start_ts IS NOT NULL AND v_effective_date IS NULL AND ((expense_date >= p_start_date AND expense_date <= COALESCE(p_end_date, CURRENT_DATE)) OR (expense_date IS NULL AND created_at >= v_start_ts AND created_at <= v_end_ts)))
      );
  ELSE
    v_ventas_mostrador := 0;
    v_egresos := 0;
  END IF;

  v_total_ingresos := v_ingresos_servicios + v_ventas_mostrador;
  v_balance_neto := v_total_ingresos - v_egresos;

  RETURN json_build_object(
    'ingresos_servicios_cents', v_ingresos_servicios,
    'ventas_mostrador_cents', v_ventas_mostrador,
    'total_ingresos_cents', v_total_ingresos,
    'total_egresos_cents', v_egresos,
    'balance_neto_cents', v_balance_neto,
    'citas_count', v_citas_count,
    'citas_confirmadas_count', v_citas_confirmadas_count,
    'query_date', v_effective_date,
    'employee_id', p_employee_id,
    'timezone', 'America/Lima'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_balances(date, date, date, uuid) TO authenticated, anon, service_role;
