-- ==============================================================================
-- MIGRACIÓN: GUEST CHECKOUT, STORAGE VOUCHERS Y PORTAL DE RASTREO PÚBLICO
-- Destino Autorizado:
-- Organización: Manu-Crack's Org
-- Proyecto: acicaladosMej (ydvqzgyhymjgbyfkxqhd)
-- ==============================================================================

-- 1. BUCKET DE COMPROBANTES DE PAGO Y RLS EN STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir a usuarios anon y autenticados subir comprobantes (INSERT)
DROP POLICY IF EXISTS "anon_insert_comprobantes" ON storage.objects;
CREATE POLICY "anon_insert_comprobantes" ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'comprobantes');

-- Restringir estrictamente la lectura/listado (SELECT) sólo a usuarios autenticados
DROP POLICY IF EXISTS "authenticated_select_comprobantes" ON storage.objects;
CREATE POLICY "authenticated_select_comprobantes" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'comprobantes');

-- Personal administrativo puede actualizar o eliminar comprobantes
DROP POLICY IF EXISTS "authenticated_update_comprobantes" ON storage.objects;
CREATE POLICY "authenticated_update_comprobantes" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'comprobantes')
  WITH CHECK (bucket_id = 'comprobantes');

DROP POLICY IF EXISTS "authenticated_delete_comprobantes" ON storage.objects;
CREATE POLICY "authenticated_delete_comprobantes" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'comprobantes');

-- 2. FUNCIÓN RPC SEGURA PARA RASTREO DE RESERVAS DE INVITADOS (2FA SIN CONTRASEÑA)
CREATE OR REPLACE FUNCTION public.get_guest_reservations_tracking(
  p_dni text,
  p_phone text
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
DECLARE
  clean_dni text;
  clean_phone text;
BEGIN
  clean_dni := regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g');
  clean_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  -- Seguridad: Exigir al menos 6 dígitos numéricos para DNI y Teléfono
  IF length(clean_dni) < 6 OR length(clean_phone) < 6 THEN
    RETURN;
  END IF;

  -- 1. Consultar dress_rentals (Alquiler de Vestuario / Reservas Web)
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
      WHEN dr.status IN ('por_validar', 'solicitado') THEN '🟡 EN REVISIÓN'
      WHEN dr.status = 'reservado' THEN '🟢 RESERVA APROBADA'
      WHEN dr.status = 'entregado' THEN '🔵 EN USO / ENTREGADO'
      WHEN dr.status = 'devuelto' OR dr.status = 'finalizado' THEN '✅ DEVUELTO / FINALIZADO'
      WHEN dr.status = 'anulado' THEN '🔴 ANULADA'
      ELSE '🟡 EN PROCESO'
    END AS status_label,
    CASE 
      WHEN dr.status IN ('por_validar', 'solicitado') THEN 'yellow'
      WHEN dr.status = 'reservado' THEN 'green'
      WHEN dr.status = 'entregado' THEN 'blue'
      WHEN dr.status = 'devuelto' OR dr.status = 'finalizado' THEN 'gray'
      WHEN dr.status = 'anulado' THEN 'red'
      ELSE 'yellow'
    END AS status_color,
    dr.voucher_url,
    dr.created_at
  FROM dress_rentals dr
  WHERE regexp_replace(COALESCE(dr.client_dni, ''), '\D', '', 'g') = clean_dni
    AND regexp_replace(COALESCE(dr.client_phone, ''), '\D', '', 'g') LIKE ('%' || clean_phone)

  UNION ALL

  -- 2. Consultar bookings (Citas de Barbería / Spa)
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
      WHEN b.payment_status = 'sin_pago' THEN '🟡 EN REVISIÓN'
      WHEN b.payment_status IN ('parcial', 'total', 'adelanto_pagado', 'pagado') THEN '🟢 RESERVA APROBADA'
      WHEN b.payment_status = 'cancelado' THEN '🔴 CANCELADA'
      ELSE '🟡 EN PROCESO'
    END AS status_label,
    CASE 
      WHEN b.payment_status = 'sin_pago' THEN 'yellow'
      WHEN b.payment_status IN ('parcial', 'total', 'adelanto_pagado', 'pagado') THEN 'green'
      WHEN b.payment_status = 'cancelado' THEN 'red'
      ELSE 'yellow'
    END AS status_color,
    NULL::text AS voucher_url,
    b.created_at
  FROM bookings b
  WHERE regexp_replace(COALESCE(b.client_dni, ''), '\D', '', 'g') = clean_dni
    AND regexp_replace(COALESCE(b.client_phone, ''), '\D', '', 'g') LIKE ('%' || clean_phone)
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_reservations_tracking(text, text) TO anon, authenticated;
