-- Apply AFTER existing migrations, first in staging. No existing rows are deleted.
-- Backend contracts for QA-002/003/004/005/006/007/008/009/015.
BEGIN;
CREATE SCHEMA IF NOT EXISTS qa_internal;
REVOKE ALL ON SCHEMA qa_internal FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS qa_internal.requests (
  id uuid PRIMARY KEY, kind text NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS qa_internal.voucher_uploads (
  path text PRIMARY KEY, kind text NOT NULL, reference uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes', linked boolean NOT NULL DEFAULT false
);
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS yape_phone text;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS yape_holder text;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS yape_qr_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes text;

-- Existing payment trigger calls its helper without qualification. Pin its path so
-- it also works when invoked by the new functions with an empty search_path.
CREATE OR REPLACE FUNCTION public.trigger_recalculate_booking_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN PERFORM public.recalculate_booking_payment(OLD.booking_id);
  ELSE PERFORM public.recalculate_booking_payment(NEW.booking_id); END IF;
  RETURN NULL;
END; $$;

-- Preserve existing amounts and rely on the existing payment recalculation trigger.
-- Only verified logs constitute money collected. Pending vouchers never confirm payment.
CREATE OR REPLACE FUNCTION qa_internal.booking_json(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(b) || jsonb_build_object('booking_services', coalesce((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.hora_inicio, s.id) FROM public.booking_services s WHERE s.booking_id=b.id
  ), '[]'::jsonb)) FROM public.bookings b WHERE b.id=p_id;
$$;

CREATE OR REPLACE FUNCTION public.qa_public_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT jsonb_build_object('advance_percentage', advance_percentage,
    'whatsapp_url', whatsapp_url, 'yape_phone', yape_phone, 'yape_holder', yape_holder,
    'yape_qr_url', yape_qr_url, 'opening_hours', opening_hours)
    FROM public.business_config ORDER BY id LIMIT 1), '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.qa_lookup_booking(p_code text, p_phone text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_phone !~ '^9[0-9]{8}$' OR length(p_code) < 7 OR length(p_code) > 50 THEN RETURN '[]'::jsonb; END IF;
  SELECT qa_internal.booking_json(id) INTO v_result FROM public.bookings
    WHERE booking_code=upper(trim(p_code)) AND client_phone=p_phone LIMIT 1;
  IF v_result IS NULL THEN RETURN '[]'::jsonb; END IF;
  -- Do not expose billing documents, email, DNI, external charge IDs or user IDs.
  RETURN jsonb_build_array(jsonb_build_object(
    'id', v_result->'id', 'booking_code', v_result->'booking_code', 'client_first_name', v_result->'client_first_name',
    'client_phone', p_phone, 'booking_date', v_result->'booking_date', 'start_time', v_result->'start_time',
    'end_time', v_result->'end_time', 'service_type', v_result->'service_type', 'booking_services', v_result->'booking_services',
    'total_price_cents', v_result->'total_price_cents', 'advance_amount_cents', v_result->'advance_amount_cents',
    'balance_cents', v_result->'balance_cents', 'payment_status', v_result->'payment_status',
    'created_at', v_result->'created_at', 'confirmed_at', v_result->'confirmed_at',
    'cancelled_at', v_result->'cancelled_at', 'expired_at', v_result->'expired_at', 'completed_at', v_result->'completed_at'));
END; $$;

CREATE OR REPLACE FUNCTION public.qa_availability(p_date date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'open_time', coalesce((SELECT nullif(opening_hours->>'open','') FROM public.business_config ORDER BY id LIMIT 1),'09:00'),
    'close_time', coalesce((SELECT nullif(opening_hours->>'close','') FROM public.business_config ORDER BY id LIMIT 1),'21:00'),
    'employees', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id,
      'full_name', concat(e.first_name,' ',e.last_name), 'type', e.type, 'active', e.is_active,
      'skills', coalesce((SELECT jsonb_agg(service_id) FROM public.employee_skills WHERE employee_id=e.id),'[]'::jsonb),
      'shift_start', to_jsonb(e)->>'shift_start', 'shift_end', to_jsonb(e)->>'shift_end'))
      FROM public.employees e WHERE e.is_active), '[]'::jsonb),
    'blocks', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'employee_id', x.employee_id,
      'block_date', x.block_date, 'start_time', x.start_time, 'end_time', x.end_time,
      'is_full_day', coalesce((to_jsonb(x)->>'is_full_day')::boolean,x.start_time IS NULL AND x.end_time IS NULL), 'status', 'aprobado')) FROM public.employee_blocks x
      WHERE x.block_date=p_date AND coalesce(to_jsonb(x)->>'status','aprobado') IN ('aprobado','activo')), '[]'::jsonb),
    'bookings', coalesce((SELECT jsonb_agg(jsonb_build_object('booking_date', b.booking_date,
      'start_time', b.start_time, 'end_time', b.end_time, 'service_type', b.service_type,
      'booking_services', coalesce((SELECT jsonb_agg(jsonb_build_object('service_id', s.service_id,
        'assigned_employee_id', s.assigned_employee_id, 'duration_minutes', s.duration_minutes,
        'hora_inicio', s.hora_inicio, 'hora_fin', s.hora_fin, 'liberado_at', s.liberado_at))
        FROM public.booking_services s WHERE s.booking_id=b.id AND s.liberado_at IS NULL
        AND coalesce(s.status,'confirmada') NOT IN ('completada','cancelada','expirada')), '[]'::jsonb)))
      FROM public.bookings b WHERE b.booking_date=p_date AND b.cancelled_at IS NULL AND b.expired_at IS NULL
      AND b.completed_at IS NULL AND coalesce(to_jsonb(b)->>'status','pendiente') NOT IN ('cancelada','expirada','completada')), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.qa_create_booking(p_request_id uuid, p_booking jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_date date := (p_booking->>'date')::date; v_start time := (p_booking->>'start_time')::time;
  v_cursor time; v_end time; v_service public.services%ROWTYPE; v_emp public.employees%ROWTYPE;
  v_entry jsonb; v_rows jsonb := '[]'; v_total integer := 0; v_duration integer := 0;
  v_advance integer := 0; v_pct integer; v_id uuid := gen_random_uuid(); v_result jsonb;
  v_existing qa_internal.requests%ROWTYPE; v_staff boolean := coalesce(public.get_user_role() IN ('admin','recepcionista'),false);
  v_open time := '09:00'; v_close time := '21:00'; v_config jsonb;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));
  SELECT * INTO v_existing FROM qa_internal.requests WHERE id=p_request_id;
  IF FOUND THEN
    IF v_existing.kind <> 'booking' OR v_existing.fingerprint <> md5(p_booking::text) THEN RAISE EXCEPTION 'Solicitud reutilizada con datos diferentes'; END IF;
    RETURN v_existing.result;
  END IF;
  IF coalesce(trim(p_booking->>'client_name'),'')='' OR coalesce(p_booking->>'client_phone','') !~ '^9[0-9]{8}$'
    OR coalesce(jsonb_array_length(p_booking->'services'),0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Datos de reserva inválidos'; END IF;
  IF v_date IS NULL OR v_start IS NULL OR v_date+v_start <= (now() AT TIME ZONE 'America/Lima') THEN RAISE EXCEPTION 'El horario ya pasó'; END IF;
  -- Serialize creation per day: another transaction sees committed reservations before checking.
  PERFORM pg_advisory_xact_lock(hashtext('booking:' || v_date::text));
  SELECT to_jsonb(c) INTO v_config FROM public.business_config c ORDER BY id LIMIT 1;
  v_pct := greatest(0,least(100,coalesce((v_config->>'advance_percentage')::integer,25)));
  v_open := coalesce(nullif(v_config#>>'{opening_hours,open}','')::time, v_open);
  v_close := coalesce(nullif(v_config#>>'{opening_hours,close}','')::time, v_close);
  v_cursor := v_start;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_booking->'services') LOOP
    SELECT * INTO v_service FROM public.services WHERE id=(v_entry->>'service_id')::uuid AND is_active FOR SHARE;
    IF NOT FOUND OR (NOT v_staff AND NOT v_service.is_public) THEN RAISE EXCEPTION 'Servicio no disponible'; END IF;
    SELECT * INTO v_emp FROM public.employees WHERE id=(v_entry->>'employee_id')::uuid AND is_active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Especialista no disponible'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.employee_skills WHERE employee_id=v_emp.id AND service_id=v_service.id)
      AND NOT ((v_service.type='barberia' AND v_emp.type IN ('barbero','barberia')) OR (v_service.type='spa' AND v_emp.type='spa'))
      THEN RAISE EXCEPTION 'Especialista no habilitado para el servicio'; END IF;
    v_end := v_cursor + make_interval(mins => v_service.duration_minutes);
    IF v_cursor < v_open OR v_end > v_close OR v_end <= v_cursor THEN RAISE EXCEPTION 'Servicio fuera del horario de atención'; END IF;
    IF (nullif(to_jsonb(v_emp)->>'shift_start','') IS NOT NULL AND v_cursor < (to_jsonb(v_emp)->>'shift_start')::time)
      OR (nullif(to_jsonb(v_emp)->>'shift_end','') IS NOT NULL AND v_end > (to_jsonb(v_emp)->>'shift_end')::time)
      THEN RAISE EXCEPTION 'Especialista fuera de turno'; END IF;
    IF EXISTS (SELECT 1 FROM public.employee_blocks x WHERE x.employee_id=v_emp.id AND x.block_date=v_date
      AND coalesce(to_jsonb(x)->>'status','aprobado') IN ('aprobado','activo')
      AND (coalesce((to_jsonb(x)->>'is_full_day')::boolean,x.start_time IS NULL AND x.end_time IS NULL) OR (v_cursor < coalesce(x.end_time,'23:59'::time) AND v_end > coalesce(x.start_time,'00:00'::time))))
      THEN RAISE EXCEPTION 'Especialista con permiso o bloqueo'; END IF;
    IF EXISTS (SELECT 1 FROM public.bookings b LEFT JOIN public.booking_services s ON s.booking_id=b.id
      WHERE b.booking_date=v_date AND b.cancelled_at IS NULL AND b.expired_at IS NULL AND b.completed_at IS NULL
      AND coalesce(to_jsonb(b)->>'status','pendiente') NOT IN ('cancelada','expirada','completada')
      AND (coalesce(s.assigned_employee_id,b.assigned_employee_id)=v_emp.id OR coalesce(s.assigned_employee_id,b.assigned_employee_id) IS NULL)
      AND s.liberado_at IS NULL AND coalesce(s.status,'confirmada') NOT IN ('completada','cancelada','expirada')
      AND v_cursor < coalesce(s.hora_fin,s.end_time,b.end_time) AND v_end > coalesce(s.hora_inicio,s.start_time,b.start_time))
      THEN RAISE EXCEPTION 'El horario acaba de ocuparse. Selecciona otro.'; END IF;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('service_id',v_service.id,'service_name',v_service.name,
      'service_price_cents',v_service.price_cents,'duration_minutes',v_service.duration_minutes,'assigned_employee_id',v_emp.id,
      'hora_inicio',v_cursor,'hora_fin',v_end));
    v_total := v_total + v_service.price_cents; v_duration := v_duration + v_service.duration_minutes; v_cursor := v_end;
  END LOOP;
  IF v_staff THEN v_advance := coalesce((p_booking->>'advance_amount_cents')::integer,0); END IF;
  IF v_advance < 0 OR v_advance > v_total THEN RAISE EXCEPTION 'Adelanto inválido'; END IF;
  INSERT INTO public.bookings(id,booking_code,user_id,client_first_name,client_last_name,client_phone,client_email,client_dni,
    booking_date,start_time,end_time,service_type,total_duration_minutes,total_price_cents,advance_percentage,
    advance_amount_cents,balance_cents,payment_status,assigned_employee_id,notes)
  VALUES(v_id,'AC-'||upper(replace(gen_random_uuid()::text,'-','')),auth.uid(),trim(p_booking->>'client_name'),'',
    p_booking->>'client_phone',nullif(p_booking->>'client_email',''),nullif(p_booking->>'client_dni',''),v_date,v_start,v_cursor,
    p_booking->>'type',v_duration,v_total,v_pct,0,v_total,'sin_pago',(v_rows->0->>'assigned_employee_id')::uuid,p_booking->>'notes');
  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_rows) LOOP
    INSERT INTO public.booking_services(booking_id,service_id,service_name,service_price_cents,duration_minutes,assigned_employee_id,hora_inicio,hora_fin,start_time,end_time,status)
    VALUES(v_id,(v_entry->>'service_id')::uuid,v_entry->>'service_name',(v_entry->>'service_price_cents')::integer,
      (v_entry->>'duration_minutes')::integer,(v_entry->>'assigned_employee_id')::uuid,(v_entry->>'hora_inicio')::time,
      (v_entry->>'hora_fin')::time,(v_entry->>'hora_inicio')::time,(v_entry->>'hora_fin')::time,'confirmada');
  END LOOP;
  IF v_advance > 0 THEN
    INSERT INTO public.payment_logs(booking_id,amount_cents,payment_method,payment_type,cash_amount_cents,yape_amount_cents,status,registered_by,notes)
    VALUES(v_id,v_advance,coalesce(p_booking->>'payment_method','efectivo'),'advance',coalesce((p_booking->>'cash_cents')::integer,0),
      coalesce((p_booking->>'yape_cents')::integer,0),'verified',auth.uid(),p_booking->>'payment_notes');
    UPDATE public.bookings SET advance_amount_cents=v_advance,balance_cents=v_total-v_advance,
      payment_status=CASE WHEN v_advance=v_total THEN 'total' ELSE 'parcial' END,confirmed_at=now() WHERE id=v_id;
  END IF;
  v_result := qa_internal.booking_json(v_id);
  INSERT INTO qa_internal.requests VALUES(p_request_id,'booking',md5(p_booking::text),v_result);
  RETURN v_result;
END; $$;

-- Disable direct public creation: bypassing the RPC must not bypass validation.
REVOKE INSERT ON public.bookings, public.booking_services FROM anon, authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('payment-vouchers','payment-vouchers',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.qa_prepare_voucher(p_kind text,p_reference uuid,p_code text,p_phone text,p_extension text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_path text;
BEGIN
  IF p_kind NOT IN ('booking','dress') OR p_reference IS NULL OR p_extension NOT IN ('jpg','png','webp') THEN RAISE EXCEPTION 'Comprobante inválido'; END IF;
  IF p_kind='booking' AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id=p_reference AND
    ((b.booking_code=upper(trim(p_code)) AND b.client_phone=p_phone) OR b.user_id=auth.uid() OR public.get_user_role() IN ('admin','recepcionista'))
    AND b.cancelled_at IS NULL AND b.expired_at IS NULL) THEN RAISE EXCEPTION 'Reserva no disponible'; END IF;
  v_path := p_kind||'/'||p_reference::text||'/'||gen_random_uuid()::text||'.'||p_extension;
  INSERT INTO qa_internal.voucher_uploads(path,kind,reference) VALUES(v_path,p_kind,p_reference);
  RETURN v_path;
END; $$;

CREATE OR REPLACE FUNCTION public.qa_can_upload_voucher(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM qa_internal.voucher_uploads WHERE path=p_path AND expires_at>now() AND NOT linked);
$$;
DROP POLICY IF EXISTS qa_voucher_insert ON storage.objects;
CREATE POLICY qa_voucher_insert ON storage.objects FOR INSERT TO anon,authenticated
WITH CHECK(bucket_id='payment-vouchers' AND public.qa_can_upload_voucher(name));
DROP POLICY IF EXISTS qa_voucher_select ON storage.objects;
CREATE POLICY qa_voucher_select ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='payment-vouchers' AND public.get_user_role() IN ('admin','recepcionista','VESTUARIO_ADMIN'));

CREATE OR REPLACE FUNCTION public.qa_submit_booking_voucher(p_booking_id uuid,p_code text,p_phone text,p_path text,p_amount integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_log public.payment_logs%ROWTYPE; v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT coalesce((v_booking.booking_code=upper(trim(p_code)) AND v_booking.client_phone=p_phone)
    OR v_booking.user_id=auth.uid() OR public.get_user_role() IN ('admin','recepcionista'),false)
    OR v_booking.cancelled_at IS NOT NULL OR v_booking.expired_at IS NOT NULL THEN RAISE EXCEPTION 'Reserva no disponible'; END IF;
  SELECT * INTO v_log FROM public.payment_logs WHERE booking_id=p_booking_id AND proof_url=p_path;
  IF FOUND THEN RETURN to_jsonb(v_log); END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>v_booking.balance_cents THEN RAISE EXCEPTION 'Monto declarado inválido'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qa_internal.voucher_uploads u JOIN storage.objects o ON o.name=u.path AND o.bucket_id='payment-vouchers'
    WHERE u.path=p_path AND u.kind='booking' AND u.reference=p_booking_id AND NOT u.linked) THEN RAISE EXCEPTION 'El comprobante no existe en Storage'; END IF;
  INSERT INTO public.payment_logs(booking_id,amount_cents,payment_method,payment_type,proof_url,status,idempotency_key)
    VALUES(p_booking_id,p_amount,'yape','advance',p_path,'pending',p_path) RETURNING * INTO v_log;
  UPDATE qa_internal.voucher_uploads SET linked=true WHERE path=p_path;
  RETURN to_jsonb(v_log);
END; $$;

CREATE OR REPLACE FUNCTION public.qa_dress_availability(p_item uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('wardrobe_item_id',wardrobe_item_id,'item_code',item_code,
    'event_date',event_date,'return_date',return_date,'status',status)), '[]'::jsonb)
    FROM public.dress_rentals WHERE wardrobe_item_id=p_item AND status IN ('por_validar','reservado','entregado');
$$;

CREATE OR REPLACE FUNCTION public.qa_create_dress_rental(p_request_id uuid,p_rental jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item public.wardrobe_items%ROWTYPE; v_r public.dress_rentals%ROWTYPE; v_existing qa_internal.requests%ROWTYPE;
  v_staff boolean := coalesce(public.get_user_role() IN ('admin','recepcionista','VESTUARIO_ADMIN'),false);
  v_date date := (p_rental->>'event_date')::date; v_return date := (p_rental->>'return_date')::date;
  v_price integer; v_guarantee integer; v_local boolean;
  v_advance integer := (p_rental->>'advance_cents')::integer; v_path text := p_rental->>'voucher_url'; v_result jsonb;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));
  SELECT * INTO v_existing FROM qa_internal.requests WHERE id=p_request_id;
  IF FOUND THEN
    IF v_existing.kind<>'dress' OR v_existing.fingerprint<>md5(p_rental::text) THEN RAISE EXCEPTION 'Solicitud reutilizada'; END IF;
    RETURN v_existing.result;
  END IF;
  SELECT * INTO v_item FROM public.wardrobe_items WHERE id=(p_rental->>'wardrobe_item_id')::uuid FOR UPDATE;
  IF NOT FOUND OR NOT v_item.is_active OR v_item.availability_status<>'disponible' THEN RAISE EXCEPTION 'La prenda ya no está disponible'; END IF;
  v_local:=v_staff AND p_rental->>'origin'='local';
  v_price:=CASE WHEN v_local THEN coalesce((p_rental->>'rental_price_cents')::integer,v_item.price_cents) ELSE v_item.price_cents END;
  v_guarantee:=CASE WHEN v_local THEN coalesce((p_rental->>'guarantee_cents')::integer,v_item.deposit_cents,0) ELSE coalesce(v_item.deposit_cents,0) END;
  IF v_price<0 OR v_guarantee<0 OR (v_local AND (p_rental->>'is_immediate_delivery')::boolean AND v_advance<>v_price) THEN RAISE EXCEPTION 'Importes de entrega inválidos'; END IF;
  IF v_date IS NULL OR v_return IS NULL OR v_date<(now() AT TIME ZONE 'America/Lima')::date OR v_return<v_date THEN RAISE EXCEPTION 'Fechas inválidas'; END IF;
  IF EXISTS(SELECT 1 FROM public.dress_rentals WHERE wardrobe_item_id=v_item.id AND status IN ('por_validar','reservado','entregado')
    AND event_date<=v_return AND return_date>=v_date) THEN RAISE EXCEPTION 'La prenda está reservada en esas fechas'; END IF;
  IF coalesce(trim(p_rental->>'client_first_name'),'')='' OR coalesce(trim(p_rental->>'client_last_name'),'')=''
    OR coalesce(p_rental->>'client_phone','') !~ '^9[0-9]{8}$' OR coalesce(p_rental->>'client_dni','') !~ '^[0-9]{8}$'
    OR coalesce(trim(p_rental->>'event_name'),'')='' OR coalesce(trim(p_rental->>'destination'),'')=''
    OR v_advance IS NULL OR v_advance<0 OR v_advance>v_price THEN RAISE EXCEPTION 'Datos del alquiler inválidos'; END IF;
  IF NOT v_staff OR p_rental->>'origin'='web' THEN
    IF v_advance<=0 OR NOT EXISTS(SELECT 1 FROM qa_internal.voucher_uploads u JOIN storage.objects o ON o.name=u.path AND o.bucket_id='payment-vouchers'
      WHERE u.path=v_path AND u.kind='dress' AND u.reference=p_request_id AND NOT u.linked) THEN RAISE EXCEPTION 'Debes cargar un comprobante válido'; END IF;
  END IF;
  INSERT INTO public.dress_rentals(ticket_code,origin,wardrobe_item_id,item_code,item_name,item_size,item_color,client_first_name,client_last_name,
    client_dni,client_phone,event_name,destination,event_date,return_date,status,rental_price_cents,advance_cents,pending_cents,guarantee_cents,
    is_immediate_delivery,delivery_date,voucher_url,voucher_declared_amount_cents,notes)
  VALUES((CASE WHEN v_staff AND p_rental->>'origin'='local' THEN 'P-' ELSE 'W-' END)||upper(replace(gen_random_uuid()::text,'-','')),
    CASE WHEN v_staff AND p_rental->>'origin'='local' THEN 'local' ELSE 'web' END,v_item.id,v_item.code,v_item.name,v_item.size,v_item.color,
    trim(p_rental->>'client_first_name'),trim(p_rental->>'client_last_name'),p_rental->>'client_dni',p_rental->>'client_phone',
    p_rental->>'event_name',p_rental->>'destination',v_date,v_return,
    CASE WHEN v_staff AND p_rental->>'origin'='local' THEN CASE WHEN (p_rental->>'is_immediate_delivery')::boolean THEN 'entregado' ELSE 'reservado' END ELSE 'por_validar' END,
    v_price,CASE WHEN v_staff AND p_rental->>'origin'='local' THEN v_advance ELSE 0 END,
    v_price-CASE WHEN v_staff AND p_rental->>'origin'='local' THEN v_advance ELSE 0 END,v_guarantee,
    v_staff AND p_rental->>'origin'='local' AND coalesce((p_rental->>'is_immediate_delivery')::boolean,false),
    CASE WHEN v_staff AND p_rental->>'origin'='local' AND (p_rental->>'is_immediate_delivery')::boolean THEN now() END,
    nullif(v_path,''),v_advance,p_rental->>'notes') RETURNING * INTO v_r;
  UPDATE qa_internal.voucher_uploads SET linked=true WHERE path=v_path;
  v_result:=to_jsonb(v_r); INSERT INTO qa_internal.requests VALUES(p_request_id,'dress',md5(p_rental::text),v_result);
  RETURN v_result;
END; $$;
DROP POLICY IF EXISTS dress_rentals_public_select ON public.dress_rentals;
DROP POLICY IF EXISTS dress_rentals_public_insert ON public.dress_rentals;
REVOKE ALL ON public.dress_rentals FROM anon;
REVOKE INSERT ON public.dress_rentals FROM authenticated;

CREATE OR REPLACE FUNCTION public.qa_transition_dress(p_id uuid,p_action text,p_amount integer DEFAULT 0,p_guarantee integer DEFAULT 0,p_reason text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_r public.dress_rentals%ROWTYPE;
BEGIN
  IF NOT coalesce(public.get_user_role() IN ('admin','recepcionista','VESTUARIO_ADMIN'),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_r FROM public.dress_rentals WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alquiler no encontrado'; END IF;
  IF p_action='approve' AND v_r.status='por_validar' THEN
    UPDATE public.dress_rentals SET status='reservado',advance_cents=coalesce(voucher_declared_amount_cents,0),
      pending_cents=rental_price_cents-coalesce(voucher_declared_amount_cents,0) WHERE id=p_id;
  ELSIF p_action='cancel' AND v_r.status IN ('por_validar','reservado') THEN
    UPDATE public.dress_rentals SET status='anulado',rejection_reason=p_reason WHERE id=p_id;
  ELSIF p_action='deliver' AND v_r.status='reservado' THEN
    IF p_amount IS NULL OR p_guarantee IS NULL OR p_amount<>v_r.pending_cents OR p_guarantee<0 THEN RAISE EXCEPTION 'Cobro de entrega inválido'; END IF;
    UPDATE public.dress_rentals SET status='entregado',advance_cents=advance_cents+p_amount,pending_cents=0,
      guarantee_cents=p_guarantee,delivery_date=now() WHERE id=p_id;
  ELSIF p_action='return' AND v_r.status='entregado' THEN
    IF p_guarantee IS NULL OR p_guarantee<0 OR p_guarantee>v_r.guarantee_cents THEN RAISE EXCEPTION 'Devolución inválida'; END IF;
    UPDATE public.dress_rentals SET status='finalizado',guarantee_returned_cents=p_guarantee,penalty_cents=guarantee_cents-p_guarantee,
      penalty_reason=p_reason,actual_return_date=now() WHERE id=p_id;
  ELSE RAISE EXCEPTION 'El estado cambió. Actualiza antes de continuar.';
  END IF;
  SELECT * INTO v_r FROM public.dress_rentals WHERE id=p_id;
  RETURN to_jsonb(v_r);
END; $$;

CREATE OR REPLACE FUNCTION public.qa_register_payment(p_id uuid,p_booking uuid,p_amount integer,p_method text,p_cash integer,p_yape integer,p_notes text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_b public.bookings%ROWTYPE; v_p public.payment_logs%ROWTYPE;
BEGIN
  IF NOT coalesce(public.get_user_role() IN ('admin','recepcionista'),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id=p_booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  SELECT * INTO v_p FROM public.payment_logs WHERE id=p_id;
  IF FOUND THEN
    IF v_p.booking_id<>p_booking OR v_p.amount_cents<>p_amount THEN RAISE EXCEPTION 'Solicitud reutilizada'; END IF;
    RETURN to_jsonb(v_p);
  END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>v_b.balance_cents OR p_cash<0 OR p_yape<0 OR p_cash+p_yape>p_amount
    OR v_b.cancelled_at IS NOT NULL OR v_b.expired_at IS NOT NULL THEN RAISE EXCEPTION 'Monto o reserva inválidos'; END IF;
  INSERT INTO public.payment_logs(id,booking_id,amount_cents,payment_method,payment_type,cash_amount_cents,yape_amount_cents,status,registered_by,notes)
    VALUES(p_id,p_booking,p_amount,p_method,'partial',p_cash,p_yape,'verified',auth.uid(),p_notes) RETURNING * INTO v_p;
  UPDATE public.bookings SET advance_amount_cents=v_b.advance_amount_cents+p_amount,balance_cents=v_b.balance_cents-p_amount,
    payment_status=CASE WHEN v_b.balance_cents=p_amount THEN 'total' ELSE 'parcial' END,confirmed_at=coalesce(confirmed_at,now()) WHERE id=p_booking;
  RETURN to_jsonb(v_p);
END; $$;

-- Check new/updated stock without refusing deployment because of historic bad rows.
CREATE OR REPLACE FUNCTION public.qa_review_payment(p_id uuid,p_approved boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_p public.payment_logs%ROWTYPE; v_b public.bookings%ROWTYPE;
BEGIN
  IF NOT coalesce(public.get_user_role() IN ('admin','recepcionista'),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_p FROM public.payment_logs WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comprobante no encontrado'; END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id=v_p.booking_id FOR UPDATE;
  SELECT * INTO v_p FROM public.payment_logs WHERE id=p_id FOR UPDATE;
  IF v_p.status<>'pending' THEN RETURN to_jsonb(v_p); END IF;
  IF p_approved AND (v_p.amount_cents>v_b.balance_cents OR v_b.cancelled_at IS NOT NULL OR v_b.expired_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Monto o reserva inválidos para aprobación'; END IF;
  UPDATE public.payment_logs SET status=CASE WHEN p_approved THEN 'verified' ELSE 'rejected' END,
    verified_by=auth.uid(),verified_at=now() WHERE id=p_id RETURNING * INTO v_p;
  IF p_approved THEN
    UPDATE public.bookings SET advance_amount_cents=v_b.advance_amount_cents+v_p.amount_cents,
      balance_cents=v_b.balance_cents-v_p.amount_cents,payment_status=CASE WHEN v_b.balance_cents=v_p.amount_cents THEN 'total' ELSE 'parcial' END,
      confirmed_at=coalesce(confirmed_at,now()) WHERE id=v_b.id;
  END IF;
  RETURN to_jsonb(v_p);
END; $$;

CREATE OR REPLACE FUNCTION public.qa_void_payment(p_id uuid,p_reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_p public.payment_logs%ROWTYPE; v_b public.bookings%ROWTYPE; v_amount integer;
BEGIN
  IF NOT coalesce(public.get_user_role()='admin',false) OR length(trim(p_reason))<5 THEN RAISE EXCEPTION 'No autorizado o motivo inválido'; END IF;
  SELECT * INTO v_p FROM public.payment_logs WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id=v_p.booking_id FOR UPDATE;
  SELECT * INTO v_p FROM public.payment_logs WHERE id=p_id FOR UPDATE;
  IF v_p.status='voided' THEN RETURN true; END IF;
  v_amount := greatest(0,v_b.advance_amount_cents-CASE WHEN v_p.status='verified' THEN v_p.amount_cents ELSE 0 END);
  UPDATE public.payment_logs SET status='voided',void_reason=p_reason,voided_at=now(),voided_by=auth.uid() WHERE id=p_id;
  UPDATE public.bookings SET advance_amount_cents=v_amount,balance_cents=total_price_cents-v_amount,
    payment_status=CASE WHEN v_amount=0 THEN 'sin_pago' WHEN v_amount>=total_price_cents THEN 'total' ELSE 'parcial' END WHERE id=v_b.id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.qa_booking_voucher_status(p_id uuid,p_code text,p_phone text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.bookings WHERE id=p_id AND (user_id=auth.uid() OR (booking_code=p_code AND client_phone=p_phone)))
    THEN RAISE EXCEPTION 'Reserva no disponible'; END IF;
  RETURN coalesce((SELECT jsonb_build_object('status',status) FROM public.payment_logs
    WHERE booking_id=p_id AND proof_url IS NOT NULL ORDER BY created_at DESC LIMIT 1),'{}'::jsonb);
END; $$;

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='qa_products_nonnegative_stock' AND conrelid='public.products'::regclass) THEN
    ALTER TABLE public.products ADD CONSTRAINT qa_products_nonnegative_stock CHECK(stock>=0) NOT VALID;
  END IF;
END $$;

-- Public functions get an explicit allowlist; internal helpers are never executable by clients.
CREATE OR REPLACE FUNCTION public.qa_edit_booking(p_id uuid,p_updates jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_b public.bookings%ROWTYPE; v_s public.booking_services%ROWTYPE; v_date date; v_start time; v_delta interval;
  v_next_start time; v_next_end time;
BEGIN
  IF NOT coalesce(public.get_user_role()='admin',false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_b FROM public.bookings WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  v_date:=coalesce((p_updates->>'date')::date,v_b.booking_date);
  v_start:=coalesce((p_updates->>'start_time')::time,v_b.start_time);
  -- Both days are locked in the same order, so rescheduling and creation agree.
  PERFORM pg_advisory_xact_lock(hashtext('booking:' || least(v_date,v_b.booking_date)::text));
  PERFORM pg_advisory_xact_lock(hashtext('booking:' || greatest(v_date,v_b.booking_date)::text));
  SELECT * INTO v_b FROM public.bookings WHERE id=p_id FOR UPDATE;
  IF (p_updates ? 'total_price_cents' AND (p_updates->>'total_price_cents')::integer<>v_b.total_price_cents)
    OR (p_updates ? 'advance_amount_cents' AND (p_updates->>'advance_amount_cents')::integer<>v_b.advance_amount_cents)
    THEN RAISE EXCEPTION 'Modifica el precio por servicio o registra/anula el pago desde caja'; END IF;
  v_delta:=v_start-v_b.start_time;
  IF v_date<>v_b.booking_date OR v_start<>v_b.start_time THEN
    IF v_date+v_start <= (now() AT TIME ZONE 'America/Lima') THEN RAISE EXCEPTION 'El horario ya pasó'; END IF;
    FOR v_s IN SELECT * FROM public.booking_services WHERE booking_id=p_id LOOP
      v_next_start:=coalesce(v_s.hora_inicio,v_s.start_time,v_b.start_time)+v_delta;
      v_next_end:=v_next_start+make_interval(mins=>v_s.duration_minutes);
      IF v_next_start<'09:00'::time OR v_next_end>'21:00'::time OR v_next_end<=v_next_start THEN RAISE EXCEPTION 'Horario fuera de atención'; END IF;
      IF EXISTS(SELECT 1 FROM public.booking_services s JOIN public.bookings b ON b.id=s.booking_id
        WHERE b.id<>p_id AND b.booking_date=v_date AND (s.assigned_employee_id=v_s.assigned_employee_id OR s.assigned_employee_id IS NULL)
        AND b.cancelled_at IS NULL AND b.expired_at IS NULL AND b.completed_at IS NULL AND s.liberado_at IS NULL
        AND coalesce(to_jsonb(b)->>'status','pendiente') NOT IN ('cancelada','expirada','completada')
        AND coalesce(s.hora_inicio,s.start_time,b.start_time)<v_next_end AND coalesce(s.hora_fin,s.end_time,b.end_time)>v_next_start)
        THEN RAISE EXCEPTION 'El nuevo horario está ocupado'; END IF;
      IF EXISTS(SELECT 1 FROM public.employee_blocks x WHERE x.employee_id=v_s.assigned_employee_id AND x.block_date=v_date
        AND coalesce(to_jsonb(x)->>'status','aprobado') IN ('aprobado','activo')
        AND (coalesce((to_jsonb(x)->>'is_full_day')::boolean,x.start_time IS NULL AND x.end_time IS NULL)
          OR (v_next_start<coalesce(x.end_time,'23:59'::time) AND v_next_end>coalesce(x.start_time,'00:00'::time))))
        THEN RAISE EXCEPTION 'El especialista tiene un bloqueo'; END IF;
      UPDATE public.booking_services SET hora_inicio=v_next_start,start_time=v_next_start,hora_fin=v_next_end,end_time=v_next_end WHERE id=v_s.id;
    END LOOP;
  END IF;
  UPDATE public.bookings SET booking_date=v_date,start_time=v_start,end_time=v_b.end_time+v_delta,
    client_first_name=coalesce(nullif(trim(p_updates->>'client_name'),''),client_first_name),
    client_last_name=CASE WHEN p_updates ? 'client_name' THEN '' ELSE client_last_name END,
    client_phone=coalesce(p_updates->>'client_phone',client_phone),client_email=coalesce(p_updates->>'client_email',client_email)
    WHERE id=p_id;
  RETURN qa_internal.booking_json(p_id);
END; $$;

CREATE OR REPLACE FUNCTION public.qa_update_booking_service(p_id uuid,p_action text,p_value text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_s public.booking_services%ROWTYPE; v_b public.bookings%ROWTYPE; v_emp uuid; v_total integer;
BEGIN
  IF NOT coalesce(public.get_user_role() IN ('admin','recepcionista'),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_s FROM public.booking_services WHERE id=p_id;
  SELECT * INTO v_b FROM public.bookings WHERE id=v_s.booking_id;
  IF v_b.id IS NULL THEN RAISE EXCEPTION 'Servicio no encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('booking:' || v_b.booking_date::text));
  PERFORM 1 FROM public.bookings WHERE id=v_b.id FOR UPDATE;
  IF p_action='release' THEN
    UPDATE public.booking_services SET liberado_at=now(),status='completada' WHERE id=p_id AND liberado_at IS NULL;
  ELSIF p_action='price' THEN
    IF public.get_user_role()<>'admin' OR p_value::integer<0 THEN RAISE EXCEPTION 'Precio o permiso inválidos'; END IF;
    UPDATE public.booking_services SET service_price_cents=p_value::integer WHERE id=p_id;
    SELECT sum(service_price_cents) INTO v_total FROM public.booking_services WHERE booking_id=v_b.id;
    IF v_total<v_b.advance_amount_cents THEN RAISE EXCEPTION 'El nuevo total es menor al monto ya cobrado'; END IF;
    UPDATE public.bookings SET total_price_cents=v_total,balance_cents=v_total-advance_amount_cents,
      payment_status=CASE WHEN advance_amount_cents=0 THEN 'sin_pago' WHEN advance_amount_cents>=v_total THEN 'total' ELSE 'parcial' END WHERE id=v_b.id;
  ELSIF p_action='assign' THEN
    v_emp:=p_value::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=v_emp AND is_active) THEN RAISE EXCEPTION 'Especialista inactivo'; END IF;
    IF EXISTS(SELECT 1 FROM public.booking_services s JOIN public.bookings b ON b.id=s.booking_id
      WHERE s.id<>p_id AND s.assigned_employee_id=v_emp AND b.booking_date=v_b.booking_date
      AND b.cancelled_at IS NULL AND b.expired_at IS NULL AND b.completed_at IS NULL AND s.liberado_at IS NULL
      AND coalesce(to_jsonb(b)->>'status','pendiente') NOT IN ('cancelada','expirada','completada')
      AND coalesce(s.hora_inicio,s.start_time,b.start_time)<coalesce(v_s.hora_fin,v_s.end_time,v_b.end_time)
      AND coalesce(s.hora_fin,s.end_time,b.end_time)>coalesce(v_s.hora_inicio,v_s.start_time,v_b.start_time)) THEN RAISE EXCEPTION 'Especialista ocupado'; END IF;
    UPDATE public.booking_services SET assigned_employee_id=v_emp WHERE id=p_id;
    IF p_id=(SELECT id FROM public.booking_services WHERE booking_id=v_b.id ORDER BY hora_inicio,id LIMIT 1) THEN
      UPDATE public.bookings SET assigned_employee_id=v_emp WHERE id=v_b.id;
    END IF;
  ELSE RAISE EXCEPTION 'Acción inválida'; END IF;
  RETURN qa_internal.booking_json(v_b.id);
END; $$;

CREATE OR REPLACE FUNCTION public.qa_process_pos_sale(p_request_id uuid,p_sale jsonb,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row record; v_stock integer; v_result jsonb; v_existing qa_internal.requests%ROWTYPE;
  v_fingerprint text := md5(((p_sale-'fecha'-'created_at')::text)||p_items::text);
BEGIN
  IF NOT coalesce(public.get_user_role() IN ('admin','recepcionista'),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_request_id IS NULL OR coalesce(jsonb_array_length(p_items),0)=0 THEN RAISE EXCEPTION 'Venta vacía'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));
  SELECT * INTO v_existing FROM qa_internal.requests WHERE id=p_request_id;
  IF FOUND THEN
    IF v_existing.kind<>'sale' OR v_existing.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'Solicitud reutilizada'; END IF;
    RETURN v_existing.result;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE (x->>'quantity') IS NULL
    OR (x->>'quantity')::numeric<=0 OR (x->>'quantity')::numeric<>trunc((x->>'quantity')::numeric)) THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  -- Lock in deterministic order; aggregate duplicate product lines before checking stock.
  FOR v_row IN SELECT (x->>'product_id')::uuid id,sum((x->>'quantity')::integer) quantity
    FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'product_id','') IS NOT NULL GROUP BY 1 ORDER BY 1 LOOP
    SELECT p.stock INTO v_stock FROM public.products p WHERE p.id=v_row.id AND coalesce((to_jsonb(p)->>'is_active')::boolean,true) AND coalesce(to_jsonb(p)->>'use_type','venta')<>'consumo_interno' FOR UPDATE;
    IF NOT FOUND OR v_stock<v_row.quantity THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
  END LOOP;
  -- Reuse the existing POS transaction, preserving its accounting and inventory movements.
  SELECT public.process_pos_sale(p_sale,p_items)::jsonb INTO v_result;
  IF v_result IS NULL OR v_result->>'sale_id' IS NULL OR v_result->>'success'='false' THEN RAISE EXCEPTION 'La venta no fue confirmada'; END IF;
  INSERT INTO qa_internal.requests VALUES(p_request_id,'sale',v_fingerprint,v_result);
  RETURN v_result;
END; $$;
-- Only the wrapper may invoke the old POS entry point. Do not alter its implementation.
DO $$ BEGIN
  IF to_regprocedure('public.process_pos_sale(jsonb,jsonb)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.process_pos_sale(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
  END IF;
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'qa_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    IF f.proname IN ('qa_transition_dress','qa_register_payment','qa_review_payment','qa_void_payment','qa_update_booking_service','qa_process_pos_sale','qa_edit_booking') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
    ELSE EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated',f.signature); END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA qa_internal FROM PUBLIC, anon, authenticated;
COMMIT;
