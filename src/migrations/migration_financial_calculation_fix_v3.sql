-- ==============================================================================
-- MIGRACIÓN V3: CORRECCIÓN DE CÁLCULO FINANCIERO (ADELANTOS VS TOTAL) Y FILTRADO POR DÍA
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
--
-- Correcciones:
-- 1. En get_financial_balances:
--    - Elimina 'completed_at IS NOT NULL' de la condición de pago total (una cita completada con pago parcial debe sumar estrictamente su adelanto, no el total).
--    - Si payment_status = 'parcial' o advance_amount_cents < total_price_cents, suma estrictamente advance_amount_cents.
--    - Delimita fechas en zona horaria America/Lima (UTC-5) para que consultas del día no lean movimientos de fechas anteriores ni sufran desfases.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_financial_balances(
  p_date date DEFAULT NULL::date, 
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date
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
  -- Si se pasa p_date específico, establecemos los límites exactos de 00:00:00 a 23:59:59 en America/Lima (UTC-5)
  IF p_date IS NOT NULL THEN
    v_effective_date := p_date;
    v_start_ts := (p_date::text || ' 00:00:00 America/Lima')::timestamptz;
    v_end_ts   := (p_date::text || ' 23:59:59.999 America/Lima')::timestamptz;
  ELSIF p_start_date IS NOT NULL THEN
    v_effective_date := NULL;
    v_start_ts := (p_start_date::text || ' 00:00:00 America/Lima')::timestamptz;
    v_end_ts   := (COALESCE(p_end_date, CURRENT_DATE)::text || ' 23:59:59.999 America/Lima')::timestamptz;
  ELSE
    -- Por defecto: día actual en hora local de Perú (America/Lima)
    v_effective_date := (now() AT TIME ZONE 'America/Lima')::date;
    v_start_ts := (v_effective_date::text || ' 00:00:00 America/Lima')::timestamptz;
    v_end_ts   := (v_effective_date::text || ' 23:59:59.999 America/Lima')::timestamptz;
  END IF;

  -- 1. Citas activas e ingresos de servicios
  -- LÓGICA ESTRICTA DE ADELANTOS:
  -- - Si está cancelada o expirada: 0.
  -- - Si es pago parcial o adelanto menor al precio total: suma ESTRICTAMENTE el adelanto cobrado.
  -- - Solo si payment_status = 'total' o adelanto >= precio total: suma el monto total de la cita.
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN cancelled_at IS NOT NULL OR expired_at IS NOT NULL THEN 0
        WHEN payment_status = 'total' OR (COALESCE(total_price_cents, 0) > 0 AND COALESCE(advance_amount_cents, 0) >= COALESCE(total_price_cents, 0))
          THEN GREATEST(COALESCE(total_price_cents, 0), COALESCE(advance_amount_cents, 0))
        WHEN payment_status = 'parcial' OR COALESCE(advance_amount_cents, 0) > 0
          THEN LEAST(COALESCE(advance_amount_cents, 0), COALESCE(total_price_cents, advance_amount_cents))
        ELSE 0
      END
    ), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_status IN ('total', 'parcial'))
  INTO v_ingresos_servicios, v_citas_count, v_citas_confirmadas_count
  FROM public.bookings
  WHERE (cancelled_at IS NULL AND expired_at IS NULL)
    AND (
      (v_effective_date IS NOT NULL AND booking_date = v_effective_date)
      OR (v_start_ts IS NOT NULL AND v_effective_date IS NULL AND booking_date >= p_start_date AND booking_date <= COALESCE(p_end_date, CURRENT_DATE))
    );

  -- 2. Ventas de mostrador (delimitadas por v_start_ts y v_end_ts en America/Lima)
  SELECT COALESCE(SUM(ROUND(COALESCE(total, 0) * 100)::integer), 0)
  INTO v_ventas_mostrador
  FROM public.ventas_mostrador
  WHERE (
    (v_start_ts IS NOT NULL AND COALESCE(fecha, created_at) >= v_start_ts AND COALESCE(fecha, created_at) <= v_end_ts)
  );

  -- 3. Egresos operativos activos (delimitados por America/Lima)
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_egresos
  FROM public.expenses
  WHERE (status IS NULL OR status <> 'voided')
    AND voided_at IS NULL
    AND (
      (v_effective_date IS NOT NULL AND (expense_date = v_effective_date OR (expense_date IS NULL AND created_at >= v_start_ts AND created_at <= v_end_ts)))
      OR (v_start_ts IS NOT NULL AND v_effective_date IS NULL AND ((expense_date >= p_start_date AND expense_date <= COALESCE(p_end_date, CURRENT_DATE)) OR (expense_date IS NULL AND created_at >= v_start_ts AND created_at <= v_end_ts)))
    );

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
    'timezone', 'America/Lima'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_balances(date, date, date) TO authenticated, anon, service_role;
