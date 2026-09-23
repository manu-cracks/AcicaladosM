-- ==============================================================================
-- MIGRACIÓN: DESGLOSE DE SERVICIOS POR MÓDULO (AUDITORÍA)
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
--
-- Extrae el desglose detallado de cada servicio atendido, su precio actual,
-- especialista asignado, horario y método de pago en tiempo real.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_services_audit_breakdown(p_date date DEFAULT NULL::date)
RETURNS TABLE (
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
  completed_timestamp timestamptz,
  payment_method text,
  payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ORDER BY 
    COALESCE(bs.hora_inicio, bs.start_time, b.start_time) DESC,
    bs.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_services_audit_breakdown(date) TO authenticated, anon, service_role;
