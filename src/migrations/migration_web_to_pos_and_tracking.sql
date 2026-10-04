-- ==============================================================================
-- MIGRACIÓN: FLUJO OPERATIVO WEB-TO-POS & RASTREO UNIFICADO POR DNI
-- ==============================================================================

-- 1. PUBLICACIÓN EN SUPABASE REALTIME PARA VESTUARIO
-- Permite que los cambios e inserciones web en dress_rentals y wardrobe_items se sincronicen al instante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'dress_rentals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dress_rentals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'wardrobe_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wardrobe_items;
  END IF;
END $$;

-- 2. ÍNDICES DE ALTO RENDIMIENTO POR DNI
CREATE INDEX IF NOT EXISTS idx_dress_rentals_client_dni ON public.dress_rentals(client_dni);
CREATE INDEX IF NOT EXISTS idx_bookings_client_dni ON public.bookings(client_dni);

-- 3. POLÍTICAS RLS DE CONSULTA PÚBLICA POR DNI Y ACTUALIZACIÓN POR ROLES
-- Permitir consulta por DNI en bookings para clientes e invitados
DO $$
DECLARE
  v_cmd text := 'DROP POLICY IF EXISTS "bookings_select_public_dni" ON public.bookings';
BEGIN
  EXECUTE v_cmd;
  EXECUTE 'CREATE POLICY "bookings_select_public_dni" ON public.bookings
    FOR SELECT
    USING (client_dni IS NOT NULL)';
END $$;

-- Permitir UPDATE en dress_rentals a modista, recepcionista y admin
DO $$
DECLARE
  v_cmd text := 'DROP POLICY IF EXISTS "dress_rentals_staff_update" ON public.dress_rentals';
BEGIN
  EXECUTE v_cmd;
  EXECUTE 'CREATE POLICY "dress_rentals_staff_update" ON public.dress_rentals
    FOR UPDATE
    USING (
      COALESCE(public.get_user_role(), private.get_user_role()) IN (''admin'', ''recepcionista'', ''VESTUARIO_ADMIN'', ''modista'')
      OR current_user = ''postgres''
    )
    WITH CHECK (
      COALESCE(public.get_user_role(), private.get_user_role()) IN (''admin'', ''recepcionista'', ''VESTUARIO_ADMIN'', ''modista'')
      OR current_user = ''postgres''
    )';
END $$;

-- 4. FUNCIÓN RPC UNIFICADA DE CONSULTA POR DNI (SPA + VESTUARIO)
CREATE OR REPLACE FUNCTION public.get_reservations_by_dni(p_dni text)
RETURNS TABLE (
  reservation_id uuid,
  code text,
  reservation_type text,
  client_name text,
  client_dni text,
  client_phone text,
  reservation_date text,
  return_date text,
  start_time text,
  end_time text,
  item_or_services text,
  total_price_cents integer,
  advance_cents integer,
  pending_cents integer,
  status text,
  status_label text,
  status_color text,
  voucher_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_dni text;
BEGIN
  clean_dni := regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g');

  IF length(clean_dni) < 8 THEN
    RETURN;
  END IF;

  -- 1. Consultar dress_rentals (Órdenes de Vestuario)
  RETURN QUERY
  SELECT 
    dr.id AS reservation_id,
    dr.ticket_code AS code,
    'vestuario'::text AS reservation_type,
    (dr.client_first_name || ' ' || dr.client_last_name) AS client_name,
    dr.client_dni,
    dr.client_phone,
    dr.event_date::text AS reservation_date,
    dr.return_date::text AS return_date,
    NULL::text AS start_time,
    NULL::text AS end_time,
    (dr.item_code || ' - ' || dr.item_name) AS item_or_services,
    dr.rental_price_cents AS total_price_cents,
    dr.advance_cents,
    dr.pending_cents,
    dr.status::text,
    CASE 
      WHEN dr.status IN ('por_validar', 'solicitado') THEN '🟠 Por Validar'
      WHEN dr.status = 'reservado' THEN '🔵 Reservado'
      WHEN dr.status = 'entregado' THEN '🟢 Entregado'
      WHEN dr.status IN ('devuelto', 'finalizado') THEN '✅ Finalizado'
      WHEN dr.status = 'anulado' THEN '🔴 Anulado'
      ELSE '🟡 En Proceso'
    END AS status_label,
    CASE 
      WHEN dr.status IN ('por_validar', 'solicitado') THEN 'orange'
      WHEN dr.status = 'reservado' THEN 'blue'
      WHEN dr.status = 'entregado' THEN 'green'
      WHEN dr.status IN ('devuelto', 'finalizado') THEN 'gray'
      WHEN dr.status = 'anulado' THEN 'red'
      ELSE 'orange'
    END AS status_color,
    dr.voucher_url,
    dr.created_at
  FROM dress_rentals dr
  WHERE regexp_replace(COALESCE(dr.client_dni, ''), '\D', '', 'g') = clean_dni

  UNION ALL

  -- 2. Consultar bookings (Reservas de Servicios Spa / Barbería)
  SELECT 
    b.id AS reservation_id,
    b.booking_code AS code,
    'servicio'::text AS reservation_type,
    (b.client_first_name || ' ' || b.client_last_name) AS client_name,
    b.client_dni,
    b.client_phone,
    b.booking_date::text AS reservation_date,
    NULL::text AS return_date,
    b.start_time::text AS start_time,
    b.end_time::text AS end_time,
    COALESCE(
      (SELECT string_agg(bs.service_name, ', ') FROM booking_services bs WHERE bs.booking_id = b.id),
      b.service_type
    ) AS item_or_services,
    b.total_price_cents,
    b.advance_amount_cents AS advance_cents,
    b.balance_cents AS pending_cents,
    b.payment_status AS status,
    CASE 
      WHEN b.payment_status = 'sin_pago' THEN '🟠 Por Validar'
      WHEN b.payment_status IN ('parcial', 'total', 'adelanto_pagado', 'pagado') THEN '🔵 Reservado'
      WHEN b.payment_status = 'cancelado' THEN '🔴 Anulado'
      ELSE '🟡 En Proceso'
    END AS status_label,
    CASE 
      WHEN b.payment_status = 'sin_pago' THEN 'orange'
      WHEN b.payment_status IN ('parcial', 'total', 'adelanto_pagado', 'pagado') THEN 'blue'
      WHEN b.payment_status = 'cancelado' THEN 'red'
      ELSE 'orange'
    END AS status_color,
    NULL::text AS voucher_url,
    b.created_at
  FROM bookings b
  WHERE regexp_replace(COALESCE(b.client_dni, ''), '\D', '', 'g') = clean_dni
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservations_by_dni(text) TO anon, authenticated;

-- Función legacy con compatibilidad hacia atrás
CREATE OR REPLACE FUNCTION public.get_guest_reservations_tracking(
  p_dni text,
  p_phone text DEFAULT NULL
)
RETURNS TABLE (
  reservation_id uuid,
  code text,
  reservation_type text,
  client_name text,
  client_dni text,
  client_phone text,
  reservation_date text,
  return_date text,
  start_time text,
  end_time text,
  item_or_services text,
  total_price_cents integer,
  advance_cents integer,
  pending_cents integer,
  status text,
  status_label text,
  status_color text,
  voucher_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.get_reservations_by_dni(p_dni);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_reservations_tracking(text, text) TO anon, authenticated;
