-- MIGRACIÓN: REGISTRO DE FECHA DE ENTREGA / RECOJO EN DRESS_RENTALS
ALTER TABLE public.dress_rentals ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;
UPDATE public.dress_rentals SET fecha_entrega = delivery_date WHERE fecha_entrega IS NULL AND delivery_date IS NOT NULL;
