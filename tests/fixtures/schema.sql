-- Local contract fixture derived from database.types.ts and auditoria-supabase.md.
-- This is NOT a production schema backup and does not prove live schema parity.
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.get_user_role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('qa.test_role',true),'') $$;
CREATE TABLE public.services(id uuid PRIMARY KEY, name text, type text, price_cents integer, duration_minutes integer, is_active boolean DEFAULT true,is_public boolean DEFAULT true);
CREATE TABLE public.employees(id uuid PRIMARY KEY,first_name text,last_name text,type text,is_active boolean DEFAULT true);
CREATE TABLE public.employee_skills(employee_id uuid,service_id uuid);
CREATE TABLE public.employee_blocks(id uuid DEFAULT gen_random_uuid(),employee_id uuid,block_date date,start_time time,end_time time);
CREATE TABLE public.business_config(id integer PRIMARY KEY,advance_percentage integer,whatsapp_url text,opening_hours jsonb);
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_code text UNIQUE NOT NULL,user_id uuid,
 client_first_name text,client_last_name text,client_phone text,client_email text,client_dni text,booking_date date,start_time time,end_time time,
 service_type text,total_duration_minutes integer,total_price_cents integer,advance_percentage integer,advance_amount_cents integer,
 balance_cents integer,payment_status text,assigned_employee_id uuid,payment_method text,status text DEFAULT 'borrador',
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),cancelled_at timestamptz,expired_at timestamptz,completed_at timestamptz,confirmed_at timestamptz);
CREATE TABLE public.booking_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid REFERENCES public.bookings(id),service_id uuid,
 service_name text,service_price_cents integer,duration_minutes integer,assigned_employee_id uuid,hora_inicio time,hora_fin time,start_time time,end_time time,
 status text,liberado_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE public.payment_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid REFERENCES public.bookings(id),amount_cents integer,
 payment_method text,payment_type text,cash_amount_cents integer DEFAULT 0,yape_amount_cents integer DEFAULT 0,status text,
 proof_url text,idempotency_key text,registered_by uuid,notes text,created_at timestamptz DEFAULT now(),verified_by uuid,verified_at timestamptz,
 void_reason text,voided_at timestamptz,voided_by uuid);
-- Existing trigger contract: verified logs alone affect collected amounts.
CREATE FUNCTION public.recalculate_booking_payment(p_booking_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_total integer; BEGIN
 SELECT coalesce(sum(amount_cents),0) INTO v_total FROM payment_logs WHERE booking_id=p_booking_id AND status='verified';
 UPDATE bookings SET advance_amount_cents=v_total,balance_cents=total_price_cents-v_total,
 payment_status=CASE WHEN v_total=0 THEN 'sin_pago' WHEN v_total>=total_price_cents THEN 'total' ELSE 'parcial' END WHERE id=p_booking_id;
END $$;
CREATE FUNCTION public.trigger_recalculate_booking_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM recalculate_booking_payment(NEW.booking_id); RETURN NULL; END $$;
CREATE TRIGGER trg_payment_logs_recalculate AFTER INSERT OR UPDATE ON payment_logs FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_booking_payment();
CREATE TABLE public.wardrobe_items(id uuid PRIMARY KEY,code text,name text,size text,color text,price_cents integer,deposit_cents integer,
 is_active boolean DEFAULT true,availability_status text DEFAULT 'disponible');
CREATE TABLE public.products(id uuid PRIMARY KEY,stock integer);
CREATE FUNCTION public.process_pos_sale(p_sale jsonb,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE x jsonb; BEGIN
 FOR x IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   UPDATE public.products SET stock=stock-(x->>'quantity')::integer WHERE id=(x->>'product_id')::uuid;
 END LOOP;
 RETURN jsonb_build_object('sale_id',gen_random_uuid(),'ticket_number',p_sale->>'ticket_number');
END $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage,auth TO anon,authenticated;
GRANT INSERT,SELECT ON storage.objects TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bookings, public.booking_services TO anon,authenticated;
