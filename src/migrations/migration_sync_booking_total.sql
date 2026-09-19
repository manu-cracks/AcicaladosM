-- ==============================================================================
-- MIGRACIÓN: Sincronización y Recálculo Automático de Totales de Reservas
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Función para recalcular y sincronizar el total de la reserva
CREATE OR REPLACE FUNCTION public.sync_booking_total_from_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_booking_id uuid;
  calc_total_cents integer;
  current_advance_cents integer;
  new_payment_status text;
BEGIN
  -- Identificar el booking_id afectado (NEW en INSERT/UPDATE, OLD en DELETE)
  IF (TG_OP = 'DELETE') THEN
    target_booking_id := OLD.booking_id;
  ELSE
    target_booking_id := NEW.booking_id;
  END IF;

  IF target_booking_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calcular la suma de todos los servicios asociados a la cita
  SELECT COALESCE(SUM(service_price_cents), 0)
  INTO calc_total_cents
  FROM public.booking_services
  WHERE booking_id = target_booking_id;

  -- Obtener el adelanto ya cobrado de la reserva
  SELECT COALESCE(advance_amount_cents, 0)
  INTO current_advance_cents
  FROM public.bookings
  WHERE id = target_booking_id;

  -- Determinar el estado de pago correspondiente
  IF current_advance_cents >= calc_total_cents AND calc_total_cents > 0 THEN
    new_payment_status := 'total';
  ELSIF current_advance_cents > 0 THEN
    new_payment_status := 'parcial';
  ELSE
    new_payment_status := 'sin_pago';
  END IF;

  -- Actualizar la tabla padre bookings
  UPDATE public.bookings
  SET
    total_price_cents = calc_total_cents,
    balance_cents = GREATEST(0, calc_total_cents - current_advance_cents),
    payment_status = new_payment_status,
    updated_at = NOW()
  WHERE id = target_booking_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Eliminar trigger previo si existe
DROP TRIGGER IF EXISTS trg_sync_booking_total_from_services ON public.booking_services;

-- 3. Crear el trigger para activarse ante cambios de precio, nuevos servicios o eliminaciones
CREATE TRIGGER trg_sync_booking_total_from_services
AFTER INSERT OR UPDATE OF service_price_cents OR DELETE
ON public.booking_services
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_total_from_services();
