-- ==============================================================================
-- MIGRACIÓN V2: CORRECCIÓN DE RECÁLCULO DE PAGOS Y RPC FINANCIERO EN SUPABASE
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
--
-- Correcciones:
-- 1. Elimina referencias a columna inexistente 'status' en public.bookings.
-- 2. Actualiza public.recalculate_booking_payment para recalcular advance_amount_cents,
--    balance_cents y payment_status basados en payment_logs verificados.
-- 3. Actualiza public.get_financial_balances para considerar cancelled_at y expired_at.
-- ==============================================================================

-- 1. FUNCIÓN DE RECÁLCULO DE PAGOS
CREATE OR REPLACE FUNCTION public.recalculate_booking_payment(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid integer := 0;
  v_total_price integer := 0;
  v_new_payment_status text;
  v_last_payment_method text;
  v_confirmed_at timestamptz;
BEGIN
  IF p_booking_id IS NULL THEN
    RETURN;
  END IF;

  SELECT total_price_cents, confirmed_at
  INTO v_total_price, v_confirmed_at
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0),
         MAX(payment_method)
  INTO v_total_paid, v_last_payment_method
  FROM public.payment_logs
  WHERE booking_id = p_booking_id AND status = 'verified';

  IF v_total_paid >= v_total_price AND v_total_price > 0 THEN
    v_new_payment_status := 'total';
  ELSIF v_total_paid > 0 THEN
    v_new_payment_status := 'parcial';
  ELSE
    v_new_payment_status := 'sin_pago';
  END IF;

  UPDATE public.bookings
  SET advance_amount_cents = v_total_paid,
      balance_cents = GREATEST(0, v_total_price - v_total_paid),
      payment_status = v_new_payment_status,
      payment_method = COALESCE(v_last_payment_method, payment_method),
      confirmed_at = COALESCE(confirmed_at, CASE WHEN v_new_payment_status IN ('total', 'parcial') THEN now() ELSE NULL END),
      updated_at = now()
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_booking_payment(uuid) TO authenticated, anon, service_role;

-- 2. FUNCIÓN DE BALANCES FINANCIEROS
CREATE OR REPLACE FUNCTION public.get_financial_balances(p_date date DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ingresos_servicios integer := 0;
  v_ventas_mostrador integer := 0;
  v_egresos integer := 0;
  v_total_ingresos integer := 0;
  v_balance_neto integer := 0;
BEGIN
  -- 1. Citas activas: Si está pagada total -> total_price_cents; si tiene adelanto -> advance_amount_cents; si no -> 0
  SELECT COALESCE(SUM(
    CASE 
      WHEN cancelled_at IS NOT NULL OR expired_at IS NOT NULL THEN 0
      WHEN payment_status = 'total' OR completed_at IS NOT NULL OR COALESCE(advance_amount_cents, 0) >= COALESCE(total_price_cents, 0)
        THEN GREATEST(COALESCE(total_price_cents, 0), COALESCE(advance_amount_cents, 0))
      WHEN COALESCE(advance_amount_cents, 0) > 0 OR payment_status = 'parcial'
        THEN LEAST(COALESCE(advance_amount_cents, 0), COALESCE(total_price_cents, advance_amount_cents))
      ELSE 0
    END
  ), 0)
  INTO v_ingresos_servicios
  FROM public.bookings
  WHERE (p_date IS NULL OR booking_date = p_date);

  -- 2. Ventas mostrador concluidas
  SELECT COALESCE(SUM(ROUND(COALESCE(total, 0) * 100)::integer), 0)
  INTO v_ventas_mostrador
  FROM public.ventas_mostrador
  WHERE (p_date IS NULL OR COALESCE(fecha, created_at)::date = p_date);

  -- 3. Egresos operativos activos
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_egresos
  FROM public.expenses
  WHERE (status IS NULL OR status <> 'voided')
    AND voided_at IS NULL
    AND (p_date IS NULL OR expense_date = p_date OR (expense_date IS NULL AND created_at::date = p_date));

  v_total_ingresos := v_ingresos_servicios + v_ventas_mostrador;
  v_balance_neto := v_total_ingresos - v_egresos;

  RETURN json_build_object(
    'ingresos_servicios_cents', v_ingresos_servicios,
    'ventas_mostrador_cents', v_ventas_mostrador,
    'total_ingresos_cents', v_total_ingresos,
    'total_egresos_cents', v_egresos,
    'balance_neto_cents', v_balance_neto
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_balances(date) TO authenticated, anon, service_role;
