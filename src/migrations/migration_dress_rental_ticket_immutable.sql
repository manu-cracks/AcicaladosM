-- MIGRACIÓN: Correlativo inmutable, fecha de emisión y asesor para tickets de alquiler de vestidos
CREATE SEQUENCE IF NOT EXISTS public.dress_rental_ticket_seq START WITH 1;

ALTER TABLE public.dress_rentals 
  ADD COLUMN IF NOT EXISTS numero_ticket varchar(30),
  ADD COLUMN IF NOT EXISTS fecha_emision_ticket timestamptz,
  ADD COLUMN IF NOT EXISTS asesor_name text;

CREATE OR REPLACE FUNCTION public.get_or_create_dress_rental_ticket(
  p_rental_id uuid,
  p_asesor_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rental record;
  v_num text;
  v_fecha timestamptz;
BEGIN
  IF p_rental_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ID de alquiler inválido');
  END IF;

  SELECT id, ticket_code, numero_ticket, fecha_emision_ticket, asesor_name, status, created_at
  INTO v_rental
  FROM public.dress_rentals
  WHERE id = p_rental_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Alquiler no encontrado');
  END IF;

  -- Si el ticket ya fue emitido previamente, devolver EXACTAMENTE los datos guardados en la BD original (Inmutable)
  IF v_rental.numero_ticket IS NOT NULL THEN
    IF p_asesor_name IS NOT NULL AND TRIM(p_asesor_name) <> '' AND (v_rental.asesor_name IS NULL OR v_rental.asesor_name = '') THEN
      UPDATE public.dress_rentals
      SET asesor_name = TRIM(p_asesor_name),
          updated_at = now()
      WHERE id = p_rental_id;
      v_rental.asesor_name := TRIM(p_asesor_name);
    END IF;

    RETURN json_build_object(
      'success', true,
      'numero_ticket', v_rental.numero_ticket,
      'fecha_emision_ticket', v_rental.fecha_emision_ticket,
      'asesor_name', v_rental.asesor_name,
      'ticket_code', v_rental.ticket_code,
      'is_reprint', true
    );
  END IF;

  -- Asignar nuevo correlativo con Zero-Padding
  v_num := '001-' || LPAD(nextval('public.dress_rental_ticket_seq')::text, 7, '0');
  v_fecha := now();

  UPDATE public.dress_rentals
  SET numero_ticket = v_num,
      fecha_emision_ticket = v_fecha,
      asesor_name = COALESCE(NULLIF(TRIM(p_asesor_name), ''), asesor_name),
      updated_at = now()
  WHERE id = p_rental_id;

  RETURN json_build_object(
    'success', true,
    'numero_ticket', v_num,
    'fecha_emision_ticket', v_fecha,
    'asesor_name', COALESCE(NULLIF(TRIM(p_asesor_name), ''), v_rental.asesor_name),
    'ticket_code', v_rental.ticket_code,
    'is_reprint', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dress_rental_ticket(uuid, text) TO authenticated, anon;
