-- ==============================================================================
-- MIGRACIÓN: FILTRO POR EMPLEADO EN REPORTES Y AUDITORÍA DE SERVICIOS
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 0. Eliminar firmas anteriores para evitar ambigüedades en sobrecargas
DROP FUNCTION IF EXISTS public.get_services_audit_breakdown(date);
DROP FUNCTION IF EXISTS public.get_financial_balances(date);
DROP FUNCTION IF EXISTS public.get_financial_balances(date, date, date);

-- 1. Actualizar get_services_audit_breakdown con soporte para p_employee_id opcional
CREATE OR REPLACE FUNCTION public.get_services_audit_breakdown(
  p_date date DEFAULT NULL::date,
  p_employee_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  service_item_id uuid,
  service_id uuid,
  service_name text,
  area text,
  booking_id uuid,
  booking_code text,
  client_name text,
  price_cents integer,
  employee_id uuid,
  employee_name text,
  booking_date date,
  start_time text,
  end_time text,
  hora_rango text,
  completed_timestamp timestamp with time zone,
  payment_method text,
  payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target_date date;
BEGIN
  v_target_date := COALESCE(p_date, (now() AT TIME ZONE 'America/Lima')::date);

  RETURN QUERY
  SELECT
    bs.id AS service_item_id,
    bs.service_id,
    bs.service_name,
    CASE
      WHEN s.type ILIKE '%spa%' 
        OR bs.service_name ILIKE '%spa%' 
        OR bs.service_name ILIKE '%masaje%' 
        OR bs.service_name ILIKE '%facial%' 
        OR bs.service_name ILIKE '%acrilic%' 
        OR bs.service_name ILIKE '%exfolia%'
        OR bs.service_name ILIKE '%uña%'
        OR bs.service_name ILIKE '%manicure%'
        OR bs.service_name ILIKE '%pedicure%'
        THEN 'SPA'
      ELSE 'BARBERÍA'
    END AS area,
    b.id AS booking_id,
    b.booking_code,
    TRIM(b.client_first_name || ' ' || b.client_last_name) AS client_name,
    bs.service_price_cents AS price_cents,
    COALESCE(bs.assigned_employee_id, b.assigned_employee_id) AS employee_id,
    COALESCE(TRIM(e.first_name || ' ' || e.last_name), 'Especialista') AS employee_name,
    b.booking_date,
    COALESCE(TO_CHAR(bs.hora_inicio, 'HH24:MI'), TO_CHAR(bs.start_time, 'HH24:MI'), TO_CHAR(b.start_time, 'HH24:MI'), '10:00') AS start_time,
    COALESCE(TO_CHAR(bs.hora_fin, 'HH24:MI'), TO_CHAR(bs.end_time, 'HH24:MI'), TO_CHAR(b.end_time, 'HH24:MI'), '11:00') AS end_time,
    COALESCE(TO_CHAR(bs.hora_inicio, 'HH24:MI'), TO_CHAR(bs.start_time, 'HH24:MI'), TO_CHAR(b.start_time, 'HH24:MI'), '10:00') || ' - ' ||
    COALESCE(TO_CHAR(bs.hora_fin, 'HH24:MI'), TO_CHAR(bs.end_time, 'HH24:MI'), TO_CHAR(b.end_time, 'HH24:MI'), '11:00') AS hora_rango,
    COALESCE(bs.liberado_at, b.completed_at, b.confirmed_at, b.created_at) AS completed_timestamp,
    COALESCE(b.payment_method, (
      SELECT pl.payment_method 
      FROM public.payment_logs pl 
      WHERE pl.booking_id = b.id AND pl.status = 'verified' 
      ORDER BY pl.created_at DESC LIMIT 1
    ), 'efectivo') AS payment_method,
    b.payment_status
  FROM public.booking_services bs
  JOIN public.bookings b ON b.id = bs.booking_id
  LEFT JOIN public.employees e ON e.id = COALESCE(bs.assigned_employee_id, b.assigned_employee_id)
  LEFT JOIN public.services s ON s.id = bs.service_id
  WHERE b.cancelled_at IS NULL
    AND b.expired_at IS NULL
    AND b.booking_date = v_target_date
    AND (p_employee_id IS NULL OR COALESCE(bs.assigned_employee_id, b.assigned_employee_id) = p_employee_id)
  ORDER BY 
    COALESCE(bs.hora_inicio, bs.start_time, b.start_time) DESC,
    bs.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_services_audit_breakdown(date, uuid) TO authenticated, anon, service_role;

-- 2. Actualizar get_financial_balances con soporte para p_employee_id opcional
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
AS $function$
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
          THEN GREATEST(COALESCE(b.total_price_cents, 0), COALESCE(b.advance_amount_cents, 0))
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

    -- 3. Egresos operativos activos (solo aplican globalmente)
    SELECT COALESCE(SUM(amount_cents), 0)
    INTO v_egresos
    FROM public.expenses
    WHERE (status IS NULL OR status <> 'voided')
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_financial_balances(date, date, date, uuid) TO authenticated, anon, service_role;
