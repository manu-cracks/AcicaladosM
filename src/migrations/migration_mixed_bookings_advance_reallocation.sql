-- ==============================================================================
-- MIGRACIÓN: RESERVAS MIXTAS, DISTRIBUCIÓN DE ADELANTOS Y EXTORNO INTERNO CON RBAC
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Agregar columnas a booking_services
ALTER TABLE public.booking_services
ADD COLUMN IF NOT EXISTS solicitud_eliminacion BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.booking_services
ADD COLUMN IF NOT EXISTS advance_amount_cents INTEGER NOT NULL DEFAULT 0;

-- 2. Función para distribuir adelantos proporcionalmente en los servicios de una reserva
CREATE OR REPLACE FUNCTION public.distribuir_adelanto_reserva(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance_amount integer := 0;
  v_srv_count integer := 0;
  v_srv_total integer := 0;
  v_rec record;
  v_accumulated integer := 0;
  v_allocated integer := 0;
  v_idx integer := 0;
BEGIN
  IF p_booking_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(advance_amount_cents, 0)
  INTO v_advance_amount
  FROM public.bookings
  WHERE id = p_booking_id;

  SELECT COUNT(*), COALESCE(SUM(service_price_cents), 0)
  INTO v_srv_count, v_srv_total
  FROM public.booking_services
  WHERE booking_id = p_booking_id;

  IF v_srv_count = 0 THEN
    RETURN;
  END IF;

  IF v_advance_amount <= 0 THEN
    UPDATE public.booking_services
    SET advance_amount_cents = 0
    WHERE booking_id = p_booking_id;
    RETURN;
  END IF;

  v_idx := 0;
  v_accumulated := 0;

  FOR v_rec IN
    SELECT id, service_price_cents
    FROM public.booking_services
    WHERE booking_id = p_booking_id
    ORDER BY created_at ASC
  LOOP
    v_idx := v_idx + 1;
    IF v_idx = v_srv_count THEN
      v_allocated := GREATEST(0, v_advance_amount - v_accumulated);
    ELSE
      IF v_srv_total > 0 THEN
        v_allocated := ROUND((v_rec.service_price_cents::numeric / v_srv_total::numeric) * v_advance_amount);
      ELSE
        v_allocated := 0;
      END IF;
      v_accumulated := v_accumulated + v_allocated;
    END IF;

    UPDATE public.booking_services
    SET advance_amount_cents = v_allocated
    WHERE id = v_rec.id;
  END LOOP;
END;
$$;

-- 3. Poblar adelanto proporcional en reservas existentes
DO $$
DECLARE
  b_rec record;
BEGIN
  FOR b_rec IN SELECT DISTINCT booking_id FROM public.booking_services LOOP
    PERFORM public.distribuir_adelanto_reserva(b_rec.booking_id);
  END LOOP;
END;
$$;

-- 4. RPC para solicitar o cancelar eliminación de servicio (Recepción / Admin)
CREATE OR REPLACE FUNCTION public.solicitar_eliminacion_servicio(
  p_service_item_id uuid,
  p_solicitar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  SELECT * INTO v_item FROM public.booking_services WHERE id = p_service_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado.';
  END IF;

  UPDATE public.booking_services
  SET solicitud_eliminacion = p_solicitar
  WHERE id = p_service_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'service_id', p_service_item_id,
    'booking_id', v_item.booking_id,
    'solicitud_eliminacion', p_solicitar
  );
END;
$$;

-- 5. RPC Maestro: eliminar_servicio_con_extorno (Admin)
CREATE OR REPLACE FUNCTION public.eliminar_servicio_con_extorno(
  p_service_item_id uuid,
  p_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid := p_booking_id;
  v_target_item record;
  v_trapped_advance integer := 0;
  v_item_price integer := 0;
  v_remaining_count integer := 0;
  v_new_total_price integer := 0;
  v_total_advance integer := 0;
  v_new_balance integer := 0;
  v_new_payment_status text;
  v_remaining_rec record;
  v_accumulated_advance integer := 0;
  v_allocated integer := 0;
  v_idx integer := 0;
  v_result jsonb;
BEGIN
  -- 1. Localizar el ítem solicitado
  SELECT * INTO v_target_item
  FROM public.booking_services
  WHERE id = p_service_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El servicio solicitado no existe o ya ha sido removido.';
  END IF;

  IF v_booking_id IS NULL THEN
    v_booking_id := v_target_item.booking_id;
  END IF;

  v_item_price := COALESCE(v_target_item.service_price_cents, 0);
  v_trapped_advance := COALESCE(v_target_item.advance_amount_cents, 0);

  -- 2. Bloquear la reserva para operación atómica concurrente
  PERFORM 1 FROM public.bookings WHERE id = v_booking_id FOR UPDATE;

  -- 3. Identificar el fondo total de adelanto de la reserva
  SELECT COALESCE(advance_amount_cents, 0)
  INTO v_total_advance
  FROM public.bookings
  WHERE id = v_booking_id;

  -- 4. a) Eliminar físicamente el ítem de booking_services
  DELETE FROM public.booking_services
  WHERE id = p_service_item_id;

  -- 5. Calcular los servicios restantes y el nuevo total de la reserva
  SELECT COUNT(*), COALESCE(SUM(service_price_cents), 0)
  INTO v_remaining_count, v_new_total_price
  FROM public.booking_services
  WHERE booking_id = v_booking_id;

  -- 6. b) Extorno Interno: Reasignar el 100% del adelanto disponible a los servicios restantes
  IF v_remaining_count > 0 THEN
    v_accumulated_advance := 0;
    v_idx := 0;

    FOR v_remaining_rec IN
      SELECT id, service_price_cents
      FROM public.booking_services
      WHERE booking_id = v_booking_id
      ORDER BY created_at ASC
    LOOP
      v_idx := v_idx + 1;
      IF v_idx = v_remaining_count THEN
        -- El último servicio absorbe cualquier remanente de centavos
        v_allocated := GREATEST(0, v_total_advance - v_accumulated_advance);
      ELSE
        IF v_new_total_price > 0 THEN
          v_allocated := ROUND((v_remaining_rec.service_price_cents::numeric / v_new_total_price::numeric) * v_total_advance);
        ELSE
          v_allocated := 0;
        END IF;
        v_accumulated_advance := v_accumulated_advance + v_allocated;
      END IF;

      UPDATE public.booking_services
      SET advance_amount_cents = v_allocated,
          solicitud_eliminacion = false
      WHERE id = v_remaining_rec.id;
    END LOOP;
  END IF;

  -- 7. c) Recalcular nuevo Saldo Pendiente: (Nuevo Total) - (Nuevo Adelanto Reasignado)
  v_new_balance := GREATEST(0, v_new_total_price - v_total_advance);

  IF v_total_advance >= v_new_total_price AND v_new_total_price > 0 THEN
    v_new_payment_status := 'total';
  ELSIF v_total_advance > 0 THEN
    v_new_payment_status := 'parcial';
  ELSE
    v_new_payment_status := 'sin_pago';
  END IF;

  -- 8. Recalcular categoría dinámica principal (service_type) de la reserva
  SELECT 
    COUNT(DISTINCT computed_area),
    MAX(computed_area)
  INTO 
    v_distinct_areas_count,
    v_single_area
  FROM (
    SELECT 
      CASE 
        WHEN LOWER(COALESCE(s.type, '')) IN ('spa') THEN 'spa'
        WHEN LOWER(COALESCE(s.type, '')) IN ('barberia', 'barbero') THEN 'barberia'
        WHEN LOWER(COALESCE(e.type, '')) IN ('spa') THEN 'spa'
        WHEN LOWER(COALESCE(bs.service_name, '')) ~* '(spa|uña|acrílica|facial|masaje|pedicure|manicure)' THEN 'spa'
        ELSE 'barberia'
      END AS computed_area
    FROM public.booking_services bs
    LEFT JOIN public.services s ON s.id = bs.service_id
    LEFT JOIN public.employees e ON e.id = bs.assigned_employee_id
    WHERE bs.booking_id = v_booking_id
  ) sub;

  IF v_remaining_count = 0 THEN
    SELECT service_type INTO v_new_service_type FROM public.bookings WHERE id = v_booking_id;
  ELSIF v_remaining_count = 1 THEN
    -- Caso Único: 1 servicio restante -> asigna automáticamente el área de ese servicio
    v_new_service_type := COALESCE(v_single_area, 'barberia');
  ELSIF v_distinct_areas_count > 1 THEN
    -- Caso Mixto: 2 o más servicios activos de áreas diferentes
    v_new_service_type := 'mixto';
  ELSE
    -- Caso Homogéneo: Múltiples servicios pero todos de la misma área
    v_new_service_type := COALESCE(v_single_area, 'barberia');
  END IF;

  -- Actualizar cabecera de bookings con la matemática exacta y nueva categoría
  UPDATE public.bookings
  SET
    total_price_cents = v_new_total_price,
    advance_amount_cents = v_total_advance,
    balance_cents = v_new_balance,
    payment_status = v_new_payment_status,
    service_type = v_new_service_type,
    updated_at = NOW()
  WHERE id = v_booking_id;

  v_result := jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'deleted_service_id', p_service_item_id,
    'deleted_service_name', v_target_item.service_name,
    'item_price_cents', v_item_price,
    'trapped_advance_cents', v_trapped_advance,
    'new_total_price_cents', v_new_total_price,
    'new_advance_amount_cents', v_total_advance,
    'new_balance_cents', v_new_balance,
    'new_payment_status', v_new_payment_status,
    'new_service_type', v_new_service_type,
    'remaining_services_count', v_remaining_count
  );

  RETURN v_result;
END;
$$;

-- 6. Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.distribuir_adelanto_reserva(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_eliminacion_servicio(uuid, boolean) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.eliminar_servicio_con_extorno(uuid, uuid) TO authenticated, anon, service_role;
