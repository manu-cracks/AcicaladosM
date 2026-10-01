-- ==============================================================================
-- MIGRACIÓN: AUDITORÍA CONTABLE INMUTABLE Y TICKET TÉRMICO POS (80MM)
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. Campos Inmutables en tabla public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS numero_ticket VARCHAR(50);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS fecha_emision_ticket TIMESTAMPTZ;

-- 2. Secuencia para correlativo Zero-Padding (001-0000001)
CREATE SEQUENCE IF NOT EXISTS public.booking_ticket_seq START WITH 1 INCREMENT BY 1;

-- 3. Índice único para garantizar unicidad contable
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_numero_ticket ON public.bookings (numero_ticket) WHERE numero_ticket IS NOT NULL;

-- 4. Trigger Function para congelar fecha y asignar correlativo único exclusivamente al confirmar/pagar
CREATE OR REPLACE FUNCTION public.handle_booking_ticket_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Regla estricta de inmutabilidad:
  -- En un UPDATE, si OLD ya tenía asignado numero_ticket, NUNCA permitir sobreescribirlo ni modificar fecha_emision_ticket
  IF TG_OP = 'UPDATE' AND OLD.numero_ticket IS NOT NULL THEN
    NEW.numero_ticket := OLD.numero_ticket;
    NEW.fecha_emision_ticket := OLD.fecha_emision_ticket;
    RETURN NEW;
  END IF;

  -- Si ya viene con numero_ticket asignado (ej. inserción explícita)
  IF NEW.numero_ticket IS NOT NULL THEN
    IF NEW.fecha_emision_ticket IS NULL THEN
      NEW.fecha_emision_ticket := COALESCE(NEW.confirmed_at, now());
    END IF;
    RETURN NEW;
  END IF;

  -- Generación de Correlativo: EXCLUSIVAMENTE la primera vez que pase a estado confirmado o pagado
  IF (NEW.payment_status IN ('total', 'parcial') 
      OR NEW.confirmed_at IS NOT NULL 
      OR (NEW.advance_amount_cents IS NOT NULL AND NEW.advance_amount_cents > 0)) THEN
    NEW.numero_ticket := '001-' || LPAD(nextval('public.booking_ticket_seq')::text, 7, '0');
    NEW.fecha_emision_ticket := COALESCE(NEW.confirmed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_booking_ticket_generation
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_ticket_generation();

-- 5. Función RPC: get_or_create_booking_ticket (Regla Estricta de Reimpresión)
CREATE OR REPLACE FUNCTION public.get_or_create_booking_ticket(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_num text;
  v_fecha timestamptz;
BEGIN
  IF p_booking_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ID de reserva inválido');
  END IF;

  SELECT id, booking_code, numero_ticket, fecha_emision_ticket, payment_status, confirmed_at, created_at, advance_amount_cents
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
  END IF;

  -- Regla Estricta de Reimpresión:
  -- Si el ticket ya fue emitido previamente, devolver EXACTAMENTE los datos guardados en la BD original
  IF v_booking.numero_ticket IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'numero_ticket', v_booking.numero_ticket,
      'fecha_emision_ticket', v_booking.fecha_emision_ticket,
      'booking_code', v_booking.booking_code,
      'is_reprint', true
    );
  END IF;

  -- Asignar nuevo correlativo con Zero-Padding
  v_num := '001-' || LPAD(nextval('public.booking_ticket_seq')::text, 7, '0');
  v_fecha := COALESCE(v_booking.confirmed_at, now());

  UPDATE public.bookings
  SET numero_ticket = v_num,
      fecha_emision_ticket = v_fecha,
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success', true,
    'numero_ticket', v_num,
    'fecha_emision_ticket', v_fecha,
    'booking_code', v_booking.booking_code,
    'is_reprint', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_booking_ticket(uuid) TO authenticated, anon, service_role;
